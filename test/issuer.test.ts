import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import * as xpath from "xpath";
import { Certificate } from "../src/domain/certificate.js";
import { CAF } from "../src/domain/caf.js";
import { Issuer, IssuerError } from "../src/domain/issuer.js";

const certFixture = fileURLToPath(new URL("../fixtures/test-certificate.p12", import.meta.url));
const cafFixture = fileURLToPath(new URL("../fixtures/test-caf.xml", import.meta.url));

async function loadFixtures() {
  const certificate = await Certificate.fromP12(await readFile(certFixture), "test1234");
  const caf = await CAF.fromXML(await readFile(cafFixture));
  return { certificate, caf };
}

test("Issuer.createBoleta arma y firma una boleta con la API objetivo", async () => {
  const { certificate, caf } = await loadFixtures();

  const issuer = new Issuer({
    rut: caf.issuerRut,
    legalName: "Mi Empresa SpA",
    businessActivity: "Servicios",
    certificate,
    environment: "certification",
  });

  const boleta = await issuer.createBoleta({
    caf,
    folio: 1,
    recipient: { rut: "66666666-6" },
    items: [{ name: "Sesión kinesiología", quantity: 1, price: 25000 }],
  });

  assert.match(boleta.xml, /^<DTE version="1\.0">/);
  assert.equal(boleta.documentType, "39");
  assert.match(boleta.xml, /<RUTEmisor>76123456-7<\/RUTEmisor>/);
  assert.match(boleta.xml, /<RznSocEmisor>Mi Empresa SpA<\/RznSocEmisor>/);
  assert.match(boleta.xml, /<GiroEmisor>Servicios<\/GiroEmisor>/);
  assert.match(boleta.xml, /<RUTRecep>66666666-6<\/RUTRecep>/);
  assert.match(boleta.xml, /<MontoItem>25000<\/MontoItem>/);

  const today = new Date();
  const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  assert.match(boleta.xml, new RegExp(`<FchEmis>${expectedDate}</FchEmis>`));
});

test("Issuer.createBoleta produce una firma verificable", async () => {
  const { certificate, caf } = await loadFixtures();

  const issuer = new Issuer({
    rut: caf.issuerRut,
    certificate,
    environment: "certification",
  });

  const boleta = await issuer.createBoleta({
    caf,
    folio: 1,
    recipient: { rut: "66666666-6" },
    items: [{ name: "Sesión kinesiología", price: 25000 }],
  });

  const doc = new DOMParser().parseFromString(boleta.xml, "text/xml");
  const signatureNode = xpath.select(
    "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']",
    doc,
  )[0];
  assert.ok(signatureNode);

  const verifier = new SignedXml({ publicCert: certificate.certificatePem });
  verifier.loadSignature(signatureNode as Parameters<SignedXml["loadSignature"]>[0]);
  assert.equal(verifier.checkSignature(boleta.xml), true);
});

test("new Issuer rechaza ambientes que no sean certification", async () => {
  const { certificate } = await loadFixtures();

  assert.throws(
    () =>
      new Issuer({
        rut: "76123456-7",
        certificate,
        // @ts-expect-error -- se prueba justamente el rechazo de un valor inválido en runtime
        environment: "production",
      }),
    IssuerError,
  );
});

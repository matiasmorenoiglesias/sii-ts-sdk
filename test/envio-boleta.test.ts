import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import * as xpath from "xpath";
import { Certificate } from "../src/domain/certificate.js";
import { CAF } from "../src/domain/caf.js";
import { Boleta, type BoletaInput } from "../src/domain/boleta.js";
import { DTE } from "../src/domain/dte.js";
import { EnvioBoleta, EnvioBoletaError } from "../src/domain/envio-boleta.js";

const certFixture = fileURLToPath(new URL("../fixtures/test-certificate.p12", import.meta.url));
const cafFixture = fileURLToPath(new URL("../fixtures/test-caf.xml", import.meta.url));

async function loadFixtures() {
  const certificate = await Certificate.fromP12(await readFile(certFixture), "test1234");
  const caf = await CAF.fromXML(await readFile(cafFixture));
  return { certificate, caf };
}

function boletaInput(caf: CAF, folio: number): BoletaInput {
  return {
    folio,
    issueDate: "2026-08-27",
    issuer: { rut: caf.issuerRut, legalName: "Mi Empresa SpA", businessActivity: "Servicios" },
    recipient: { rut: "66666666-6" },
    items: [{ name: "Sesión kinesiología", quantity: 1, price: 25000 }],
    timestamp: "2026-08-27T10:00:00",
  };
}

function envioInput(caf: CAF): Parameters<typeof EnvioBoleta.sign>[1] {
  return {
    issuerRut: caf.issuerRut,
    senderRut: caf.issuerRut,
    resolutionDate: "2025-01-01",
    resolutionNumber: 0,
    timestamp: "2026-08-27T10:05:00",
  };
}

function verifySignature(xml: string, certificatePem: string): boolean {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const signatureNode = xpath.select(
    "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']",
    doc,
  )[0];
  if (!signatureNode) return false;

  const verifier = new SignedXml({ publicCert: certificatePem });
  verifier.loadSignature(signatureNode as Parameters<SignedXml["loadSignature"]>[0]);
  return verifier.checkSignature(xml);
}

test("EnvioBoleta.sign arma el sobre con Caratula y el DTE", async () => {
  const { certificate, caf } = await loadFixtures();
  const boleta = Boleta.create(caf, boletaInput(caf, 1));
  const dte = DTE.sign(boleta, certificate);

  const envio = EnvioBoleta.sign([dte], envioInput(caf), certificate);

  assert.match(envio.xml, /^<EnvioBOLETA xmlns="http:\/\/www\.sii\.cl\/SiiDte" version="1\.0">/);
  assert.match(envio.xml, /<\/EnvioBOLETA>$/);
  assert.match(envio.xml, /<SetDTE xmlns="http:\/\/www\.sii\.cl\/SiiDte" ID="SetDoc">/);
  assert.match(envio.xml, /<RutEmisor>76123456-7<\/RutEmisor>/);
  assert.match(envio.xml, /<RutReceptor>60803000-K<\/RutReceptor>/);
  assert.match(envio.xml, /<SubTotDTE><TpoDTE>39<\/TpoDTE><NroDTE>1<\/NroDTE><\/SubTotDTE>/);
  assert.ok(envio.xml.includes(dte.xml));
});

test("EnvioBoleta.sign produce una firma de sobre verificable", async () => {
  const { certificate, caf } = await loadFixtures();
  const boleta = Boleta.create(caf, boletaInput(caf, 1));
  const dte = DTE.sign(boleta, certificate);

  const envio = EnvioBoleta.sign([dte], envioInput(caf), certificate);

  assert.equal(verifySignature(envio.xml, certificate.certificatePem), true);
});

test("EnvioBoleta.sign también deja válida la firma del Documento dentro del sobre completo", async () => {
  const { certificate, caf } = await loadFixtures();
  const boleta = Boleta.create(caf, boletaInput(caf, 1));
  const dte = DTE.sign(boleta, certificate);
  const envio = EnvioBoleta.sign([dte], envioInput(caf), certificate);

  const doc = new DOMParser().parseFromString(envio.xml, "text/xml");
  const documentoSignature = xpath.select(
    "//*[local-name(.)='Signature' and ancestor::*[local-name(.)='DTE']]",
    doc,
  )[0];
  assert.ok(documentoSignature, "no se encontró la firma del Documento dentro del sobre");

  const verifier = new SignedXml({ publicCert: certificate.certificatePem });
  verifier.loadSignature(documentoSignature as Parameters<SignedXml["loadSignature"]>[0]);
  assert.equal(verifier.checkSignature(envio.xml), true);
});

test("EnvioBoleta.sign acepta múltiples DTE y respeta el permitir el receptor personalizado", async () => {
  const { certificate, caf } = await loadFixtures();
  const dte1 = DTE.sign(Boleta.create(caf, boletaInput(caf, 1)), certificate);
  const dte2 = DTE.sign(Boleta.create(caf, boletaInput(caf, 2)), certificate);

  const envio = EnvioBoleta.sign([dte1, dte2], { ...envioInput(caf), receiverRut: "1-9" }, certificate);

  assert.match(envio.xml, /<SubTotDTE><TpoDTE>39<\/TpoDTE><NroDTE>2<\/NroDTE><\/SubTotDTE>/);
  assert.match(envio.xml, /<RutReceptor>1-9<\/RutReceptor>/);
  assert.equal(verifySignature(envio.xml, certificate.certificatePem), true);
});

test("EnvioBoleta.sign rechaza un envío sin DTEs", async () => {
  const { certificate, caf } = await loadFixtures();
  assert.throws(() => EnvioBoleta.sign([], envioInput(caf), certificate), EnvioBoletaError);
});

test("EnvioBoleta.sign rechaza fecha de resolución con formato inválido", async () => {
  const { certificate, caf } = await loadFixtures();
  const dte = DTE.sign(Boleta.create(caf, boletaInput(caf, 1)), certificate);

  assert.throws(
    () => EnvioBoleta.sign([dte], { ...envioInput(caf), resolutionDate: "01-01-2025" }, certificate),
    EnvioBoletaError,
  );
});

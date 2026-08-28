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
import { DTE, DTEError } from "../src/domain/dte.js";
import type { DocumentSigner } from "../src/domain/ports/document-signer.js";

const certFixture = fileURLToPath(new URL("../fixtures/test-certificate.p12", import.meta.url));
const cafFixture = fileURLToPath(new URL("../fixtures/test-caf.xml", import.meta.url));

async function loadFixtures() {
  const certificate = await Certificate.fromP12(await readFile(certFixture), "test1234");
  const caf = await CAF.fromXML(await readFile(cafFixture));
  return { certificate, caf };
}

function baseInput(caf: CAF): BoletaInput {
  return {
    folio: 1,
    issueDate: "2026-08-27",
    issuer: { rut: caf.issuerRut, legalName: "Mi Empresa SpA", businessActivity: "Servicios" },
    recipient: { rut: "66666666-6" },
    items: [{ name: "Sesión kinesiología", quantity: 1, price: 25000 }],
    timestamp: "2026-08-27T10:00:00",
  };
}

test("DTE.sign produce un <DTE> bien formado con Documento y Signature", async () => {
  const { certificate, caf } = await loadFixtures();
  const boleta = Boleta.create(caf, baseInput(caf));
  const dte = DTE.sign(boleta, certificate);

  assert.match(dte.xml, /^<DTE version="1\.0">/);
  assert.match(dte.xml, /<\/DTE>$/);
  assert.ok(dte.xml.includes(boleta.xml));
  assert.match(dte.xml, /<Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">/);
  assert.match(dte.xml, /<Reference URI="#F1T39">/);
});

test("DTE.sign produce una firma verificable con el certificado del emisor", async () => {
  const { certificate, caf } = await loadFixtures();
  const boleta = Boleta.create(caf, baseInput(caf));
  const dte = DTE.sign(boleta, certificate);

  const doc = new DOMParser().parseFromString(dte.xml, "text/xml");
  const signatureNode = xpath.select(
    "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']",
    doc,
  )[0];
  assert.ok(signatureNode, "no se encontró el nodo Signature");

  const verifier = new SignedXml({ publicCert: certificate.certificatePem });
  verifier.loadSignature(signatureNode as Parameters<SignedXml["loadSignature"]>[0]);

  const isValid = verifier.checkSignature(dte.xml);
  assert.equal(isValid, true);
});

test("la firma del Documento sigue siendo válida embebida dentro de un ancestro con el mismo namespace", async () => {
  // Regresión: EnvioBoleta va a envolver el DTE dentro de <EnvioBOLETA
  // xmlns="http://www.sii.cl/SiiDte">. Con canonicalización XML
  // inclusiva (la que usa el SII), eso puede cambiar la forma canónica
  // de todo lo que esté adentro. Documento ya declara ese mismo
  // namespace explícitamente (ver src/domain/xml-namespace.ts) para que
  // la firma no cambie al quedar embebido. Esto lo prueba de verdad,
  // no solo por razonamiento.
  const { certificate, caf } = await loadFixtures();
  const boleta = Boleta.create(caf, baseInput(caf));
  const dte = DTE.sign(boleta, certificate);

  const wrapped = `<EnvioBOLETA xmlns="http://www.sii.cl/SiiDte" version="1.0"><SetDTE ID="SetDoc">${dte.xml}</SetDTE></EnvioBOLETA>`;

  const doc = new DOMParser().parseFromString(wrapped, "text/xml");
  const signatureNode = xpath.select(
    "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']",
    doc,
  )[0];
  assert.ok(signatureNode, "no se encontró el nodo Signature dentro del documento embebido");

  const verifier = new SignedXml({ publicCert: certificate.certificatePem });
  verifier.loadSignature(signatureNode as Parameters<SignedXml["loadSignature"]>[0]);

  const isValid = verifier.checkSignature(wrapped);
  assert.equal(isValid, true);
});

test("DTE.sign envuelve errores del firmante en DTEError", async () => {
  const { certificate, caf } = await loadFixtures();
  const boleta = Boleta.create(caf, baseInput(caf));

  const failingSigner: DocumentSigner = {
    sign() {
      throw new Error("boom");
    },
  };

  assert.throws(() => DTE.sign(boleta, certificate, failingSigner), DTEError);
});

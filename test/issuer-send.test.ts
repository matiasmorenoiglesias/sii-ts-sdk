import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Certificate } from "../src/domain/certificate.js";
import { CAF } from "../src/domain/caf.js";
import { Issuer, IssuerError } from "../src/domain/issuer.js";
import type { DocumentSigner } from "../src/domain/ports/document-signer.js";
import type { EnvioBoletaUploader, UploadResult } from "../src/domain/ports/envio-boleta-uploader.js";

const certFixture = fileURLToPath(new URL("../fixtures/test-certificate.p12", import.meta.url));
const cafFixture = fileURLToPath(new URL("../fixtures/test-caf.xml", import.meta.url));

async function loadFixtures() {
  const certificate = await Certificate.fromP12(await readFile(certFixture), "test1234");
  const caf = await CAF.fromXML(await readFile(cafFixture));
  return { certificate, caf };
}

const fakeSigner: DocumentSigner = {
  sign: () => '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">fake</Signature>',
};

class FakeUploader implements EnvioBoletaUploader {
  public lastArgs: { xml: string; senderRut: string; companyRut: string; token: string } | undefined;

  constructor(private readonly result: UploadResult) {}

  async upload(xml: string, senderRut: string, companyRut: string, token: string): Promise<UploadResult> {
    this.lastArgs = { xml, senderRut, companyRut, token };
    return this.result;
  }
}

test("Issuer.send envuelve el DTE y lo sube, devolviendo el resultado en éxito", async () => {
  const { certificate, caf } = await loadFixtures();
  const issuer = new Issuer({
    rut: caf.issuerRut,
    certificate,
    environment: "certification",
    resolutionDate: "2025-01-01",
  });

  const dte = await issuer.createBoleta({
    caf,
    folio: 1,
    recipient: { rut: "66666666-6" },
    items: [{ name: "Sesión kinesiología", price: 25000 }],
  });

  const uploader = new FakeUploader({ senderRut: caf.issuerRut, companyRut: caf.issuerRut, fileName: "x.xml", timestamp: "t", status: "0", trackId: "123" });

  const result = await issuer.send(dte, "el-token", fakeSigner, uploader);

  assert.equal(result.status, "0");
  assert.equal(result.trackId, "123");
  assert.equal(uploader.lastArgs?.token, "el-token");
  assert.ok(uploader.lastArgs?.xml.includes("EnvioBOLETA"));
  assert.ok(uploader.lastArgs?.xml.includes(dte.xml));
});

test("Issuer.send rechaza si el SII responde un status distinto de 0", async () => {
  const { certificate, caf } = await loadFixtures();
  const issuer = new Issuer({
    rut: caf.issuerRut,
    certificate,
    environment: "certification",
    resolutionDate: "2025-01-01",
  });

  const dte = await issuer.createBoleta({
    caf,
    folio: 1,
    recipient: { rut: "66666666-6" },
    items: [{ name: "Sesión kinesiología", price: 25000 }],
  });

  const uploader = new FakeUploader({ senderRut: caf.issuerRut, companyRut: caf.issuerRut, fileName: "x.xml", timestamp: "t", status: "6" });

  await assert.rejects(() => issuer.send(dte, "el-token", fakeSigner, uploader), IssuerError);
});

test("Issuer.send exige resolutionDate configurado en el constructor", async () => {
  const { certificate, caf } = await loadFixtures();
  const issuer = new Issuer({ rut: caf.issuerRut, certificate, environment: "certification" });

  const dte = await issuer.createBoleta({
    caf,
    folio: 1,
    recipient: { rut: "66666666-6" },
    items: [{ name: "Sesión kinesiología", price: 25000 }],
  });

  await assert.rejects(() => issuer.send(dte, "el-token"), IssuerError);
});

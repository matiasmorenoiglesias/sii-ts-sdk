import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Certificate } from "../src/domain/certificate.js";
import { CAF } from "../src/domain/caf.js";
import { Issuer } from "../src/domain/issuer.js";
import type {
  DteStatusInput,
  DteStatusResult,
  SiiStatusClient,
  UploadStatusResult,
} from "../src/domain/ports/sii-status-client.js";

const certFixture = fileURLToPath(new URL("../fixtures/test-certificate.p12", import.meta.url));
const cafFixture = fileURLToPath(new URL("../fixtures/test-caf.xml", import.meta.url));

async function loadIssuer() {
  const certificate = await Certificate.fromP12(await readFile(certFixture), "test1234");
  const caf = await CAF.fromXML(await readFile(cafFixture));
  const issuer = new Issuer({ rut: caf.issuerRut, certificate, environment: "certification" });
  return { issuer, caf };
}

class FakeStatusClient implements SiiStatusClient {
  public lastUploadArgs: { companyRut: string; trackId: string; token: string } | undefined;
  public lastDteArgs: { input: DteStatusInput; token: string } | undefined;

  constructor(
    private readonly uploadResult: UploadStatusResult,
    private readonly dteResult: DteStatusResult,
  ) {}

  async getUploadStatus(companyRut: string, trackId: string, token: string): Promise<UploadStatusResult> {
    this.lastUploadArgs = { companyRut, trackId, token };
    return this.uploadResult;
  }

  async getDteStatus(input: DteStatusInput, token: string): Promise<DteStatusResult> {
    this.lastDteArgs = { input, token };
    return this.dteResult;
  }
}

test("Issuer.checkUploadStatus delega en el puerto con el RUT del emisor", async () => {
  const { issuer } = await loadIssuer();
  const statusClient = new FakeStatusClient(
    { status: "EPR", trackId: "123", glosa: "Envio Procesado", accepted: "1", rejected: "0" },
    { status: "DOK" },
  );

  const result = await issuer.checkUploadStatus("123", "el-token", statusClient);

  assert.equal(result.status, "EPR");
  assert.equal(result.accepted, "1");
  assert.equal(statusClient.lastUploadArgs?.companyRut, issuer.rut);
  assert.equal(statusClient.lastUploadArgs?.trackId, "123");
  assert.equal(statusClient.lastUploadArgs?.token, "el-token");
});

test("Issuer.checkDteStatus arma el input a partir de los datos del DTE", async () => {
  const { issuer, caf } = await loadIssuer();
  const statusClient = new FakeStatusClient({ status: "EPR" }, { status: "DOK", glosa: "Documento Recibido y Aceptado" });

  const dte = await issuer.createBoleta({
    caf,
    folio: 1,
    recipient: { rut: "66666666-6" },
    items: [{ name: "Sesión kinesiología", price: 25000 }],
  });

  const result = await issuer.checkDteStatus(dte, "el-token", statusClient);

  assert.equal(result.status, "DOK");
  assert.equal(statusClient.lastDteArgs?.input.companyRut, issuer.rut);
  assert.equal(statusClient.lastDteArgs?.input.recipientRut, "66666666-6");
  assert.equal(statusClient.lastDteArgs?.input.documentType, "39");
  assert.equal(statusClient.lastDteArgs?.input.folio, 1);
  assert.equal(statusClient.lastDteArgs?.input.totalAmount, 25000);
  assert.equal(statusClient.lastDteArgs?.token, "el-token");
});

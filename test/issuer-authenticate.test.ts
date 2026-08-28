import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Certificate } from "../src/domain/certificate.js";
import { Issuer, IssuerError } from "../src/domain/issuer.js";
import type { SeedSigner } from "../src/domain/ports/seed-signer.js";
import type { SiiAuthClient, SiiSeedResult, SiiTokenResult } from "../src/domain/ports/sii-auth-client.js";

const certFixture = fileURLToPath(new URL("../fixtures/test-certificate.p12", import.meta.url));

async function loadIssuer(authClient: SiiAuthClient): Promise<{ issuer: Issuer; seedSigner: SeedSigner }> {
  const certificate = await Certificate.fromP12(await readFile(certFixture), "test1234");
  const issuer = new Issuer({ rut: certificate.issuerRut, certificate, environment: "certification" });
  const seedSigner: SeedSigner = { sign: () => "<getToken>fake-signed-seed</getToken>" };
  return { issuer, seedSigner };
}

class FakeAuthClient implements SiiAuthClient {
  constructor(
    private readonly seedResult: SiiSeedResult,
    private readonly tokenResult: SiiTokenResult,
  ) {}

  async getSeed(): Promise<SiiSeedResult> {
    return this.seedResult;
  }

  async getToken(): Promise<SiiTokenResult> {
    return this.tokenResult;
  }
}

test("Issuer.authenticate devuelve el token cuando el SII responde OK", async () => {
  const authClient = new FakeAuthClient({ status: "00", seed: "123" }, { status: "00", token: "el-token" });
  const { issuer, seedSigner } = await loadIssuer(authClient);

  const token = await issuer.authenticate(seedSigner, authClient);
  assert.equal(token, "el-token");
});

test("Issuer.authenticate rechaza si la semilla no viene con estado 00", async () => {
  const authClient = new FakeAuthClient({ status: "-1" }, { status: "00", token: "no-deberia-llegar" });
  const { issuer, seedSigner } = await loadIssuer(authClient);

  await assert.rejects(() => issuer.authenticate(seedSigner, authClient), IssuerError);
});

test("Issuer.authenticate rechaza si el token no viene con estado 00", async () => {
  const authClient = new FakeAuthClient({ status: "00", seed: "123" }, { status: "05", glosa: "Firma inválida" });
  const { issuer, seedSigner } = await loadIssuer(authClient);

  await assert.rejects(() => issuer.authenticate(seedSigner, authClient), IssuerError);
});

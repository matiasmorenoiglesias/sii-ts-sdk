import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Certificate, CertificateError } from "../src/domain/certificate.js";

const fixturePath = fileURLToPath(new URL("../fixtures/test-certificate.p12", import.meta.url));

test("Certificate.fromP12 extrae llave privada, certificado y RUT", async () => {
  const buffer = await readFile(fixturePath);
  const certificate = await Certificate.fromP12(buffer, "test1234");

  assert.match(certificate.privateKeyPem, /BEGIN (RSA )?PRIVATE KEY/);
  assert.match(certificate.certificatePem, /BEGIN CERTIFICATE/);
  assert.equal(certificate.issuerRut, "76123456-7");
});

test("Certificate.fromP12 rechaza contraseña incorrecta", async () => {
  const buffer = await readFile(fixturePath);
  await assert.rejects(
    () => Certificate.fromP12(buffer, "contraseña-mala"),
    CertificateError,
  );
});

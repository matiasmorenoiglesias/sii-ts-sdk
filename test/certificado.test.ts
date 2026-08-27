import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Certificado, CertificateError } from "../src/domain/certificado.js";

const rutaFixture = fileURLToPath(new URL("../fixtures/certificado-prueba.p12", import.meta.url));

test("Certificado.desdeP12 extrae llave privada, certificado y RUT", async () => {
  const buffer = await readFile(rutaFixture);
  const certificado = await Certificado.desdeP12(buffer, "test1234");

  assert.match(certificado.privateKeyPem, /BEGIN (RSA )?PRIVATE KEY/);
  assert.match(certificado.certificatePem, /BEGIN CERTIFICATE/);
  assert.equal(certificado.rutEmisor, "76123456-7");
});

test("Certificado.desdeP12 rechaza contraseña incorrecta", async () => {
  const buffer = await readFile(rutaFixture);
  await assert.rejects(
    () => Certificado.desdeP12(buffer, "contraseña-mala"),
    CertificateError,
  );
});

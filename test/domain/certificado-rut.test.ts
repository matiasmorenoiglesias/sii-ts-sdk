import { test } from "node:test";
import assert from "node:assert/strict";
import { Certificado, CertificateError } from "../../src/domain/certificado.js";
import type {
  CertificateParser,
  ParsedCertificate,
} from "../../src/domain/ports/certificate-parser.js";

class FakeCertificateParser implements CertificateParser {
  constructor(private readonly subject: Record<string, string>) {}

  parse(): ParsedCertificate {
    return {
      privateKeyPem: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
      certificatePem: "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----",
      subject: this.subject,
    };
  }
}

test("Certificado.desdeP12 usa serialNumber del subject como RUT si está presente", async () => {
  const parser = new FakeCertificateParser({ serialNumber: "76123456-7", CN: "EMPRESA DE PRUEBA" });
  const certificado = await Certificado.desdeP12(Buffer.alloc(0), "x", parser);
  assert.equal(certificado.rutEmisor, "76123456-7");
});

test("Certificado.desdeP12 cae a extraer el RUT del CN si no hay serialNumber", async () => {
  const parser = new FakeCertificateParser({ CN: "EMPRESA DE PRUEBA SPA, 76123456-7" });
  const certificado = await Certificado.desdeP12(Buffer.alloc(0), "x", parser);
  assert.equal(certificado.rutEmisor, "76123456-7");
});

test("Certificado.desdeP12 falla si el subject no trae RUT en ningún campo conocido", async () => {
  const parser = new FakeCertificateParser({ CN: "EMPRESA SIN RUT" });
  await assert.rejects(
    () => Certificado.desdeP12(Buffer.alloc(0), "x", parser),
    CertificateError,
  );
});

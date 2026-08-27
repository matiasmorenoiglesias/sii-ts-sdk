import { test } from "node:test";
import assert from "node:assert/strict";
import { Certificado, ErrorCertificado } from "../../src/dominio/certificado.js";
import type {
  CertificadoParseado,
  ParseadorCertificadoDigital,
} from "../../src/dominio/puertos/parseador-certificado.js";

class ParseadorFake implements ParseadorCertificadoDigital {
  constructor(private readonly subject: Record<string, string>) {}

  parsear(): CertificadoParseado {
    return {
      llavePrivadaPem: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
      certificadoPem: "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----",
      subject: this.subject,
    };
  }
}

test("Certificado.desdeP12 usa serialNumber del subject como RUT si está presente", async () => {
  const parseador = new ParseadorFake({ serialNumber: "76123456-7", CN: "EMPRESA DE PRUEBA" });
  const certificado = await Certificado.desdeP12(Buffer.alloc(0), "x", parseador);
  assert.equal(certificado.rutEmisor, "76123456-7");
});

test("Certificado.desdeP12 cae a extraer el RUT del CN si no hay serialNumber", async () => {
  const parseador = new ParseadorFake({ CN: "EMPRESA DE PRUEBA SPA, 76123456-7" });
  const certificado = await Certificado.desdeP12(Buffer.alloc(0), "x", parseador);
  assert.equal(certificado.rutEmisor, "76123456-7");
});

test("Certificado.desdeP12 falla si el subject no trae RUT en ningún campo conocido", async () => {
  const parseador = new ParseadorFake({ CN: "EMPRESA SIN RUT" });
  await assert.rejects(
    () => Certificado.desdeP12(Buffer.alloc(0), "x", parseador),
    ErrorCertificado,
  );
});

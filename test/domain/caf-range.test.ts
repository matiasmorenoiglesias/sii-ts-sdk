import { test } from "node:test";
import assert from "node:assert/strict";
import { CAF, CAFError } from "../../src/domain/caf.js";
import type { CAFParser, ParsedCAF } from "../../src/domain/ports/caf-parser.js";

class FakeCAFParser implements CAFParser {
  constructor(private readonly overrides: Partial<ParsedCAF> = {}) {}

  parse(): ParsedCAF {
    return {
      issuerRut: "76123456-7",
      legalName: "EMPRESA DE PRUEBA SPA",
      documentType: "39",
      folioRange: { from: 1, to: 100 },
      authorizedAt: "2025-01-01",
      publicKeyModulus: "fake-modulus",
      publicKeyExponent: "AQAB",
      keyId: "100",
      privateKeyPem: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----",
      ...this.overrides,
    };
  }
}

test("CAF.fromXML acepta boleta afecta (39) y exenta (41)", async () => {
  const afecta = await CAF.fromXML(Buffer.alloc(0), new FakeCAFParser({ documentType: "39" }));
  const exenta = await CAF.fromXML(Buffer.alloc(0), new FakeCAFParser({ documentType: "41" }));

  assert.equal(afecta.documentType, "39");
  assert.equal(exenta.documentType, "41");
});

test("CAF.fromXML rechaza tipos de documento fuera de alcance", async () => {
  await assert.rejects(
    () => CAF.fromXML(Buffer.alloc(0), new FakeCAFParser({ documentType: "33" })),
    CAFError,
  );
});

test("CAF.fromXML rechaza un rango de folios invertido", async () => {
  await assert.rejects(
    () => CAF.fromXML(Buffer.alloc(0), new FakeCAFParser({ folioRange: { from: 100, to: 1 } })),
    CAFError,
  );
});

test("includesFolio respeta los límites del rango", async () => {
  const caf = await CAF.fromXML(Buffer.alloc(0), new FakeCAFParser({ folioRange: { from: 10, to: 20 } }));

  assert.equal(caf.includesFolio(9), false);
  assert.equal(caf.includesFolio(10), true);
  assert.equal(caf.includesFolio(20), true);
  assert.equal(caf.includesFolio(21), false);
});

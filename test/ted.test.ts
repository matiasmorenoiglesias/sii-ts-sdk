import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createPublicKey, createVerify } from "node:crypto";
import { CAF } from "../src/domain/caf.js";
import { TED, TEDError } from "../src/domain/ted.js";
import { toISO88591 } from "../src/encoding.js";

const fixturePath = fileURLToPath(new URL("../fixtures/test-caf.xml", import.meta.url));

async function loadTestCAF(): Promise<CAF> {
  const buffer = await readFile(fixturePath);
  return CAF.fromXML(buffer);
}

function baseInput(caf: CAF) {
  return {
    issuerRut: caf.issuerRut,
    folio: 1,
    issueDate: "2026-08-27",
    recipientRut: "66666666-6",
    recipientLegalName: "Cliente de Prueba",
    totalAmount: 25000,
    firstItemName: "Sesión kinesiología",
    timestamp: "2026-08-27T10:00:00",
  };
}

test("TED.generate produce un <TED> bien formado", async () => {
  const caf = await loadTestCAF();
  const ted = TED.generate(caf, baseInput(caf));

  assert.match(ted.xml, /^<TED version="1\.0">/);
  assert.match(ted.xml, /<\/TED>$/);
  assert.match(ted.xml, /<RE>76123456-7<\/RE>/);
  assert.match(ted.xml, /<F>1<\/F>/);
  assert.match(ted.xml, /<FRMT algoritmo="SHA1withRSA">/);
  // el bloque CAF debe quedar embebido tal cual, sin reconstruir
  assert.ok(ted.xml.includes(caf.rawXml));
});

test("TED.generate produce una firma verificable con la llave pública del CAF", async () => {
  const caf = await loadTestCAF();
  const ted = TED.generate(caf, baseInput(caf));

  const ddMatch = ted.xml.match(/<DD>[\s\S]*<\/DD>/);
  const frmtMatch = ted.xml.match(/<FRMT[^>]*>([^<]+)<\/FRMT>/);
  assert.ok(ddMatch && frmtMatch, "no se pudo extraer DD/FRMT del TED generado");

  const modulusB64 = base64urlFromBase64(caf.publicKeyModulus);
  const exponentB64 = base64urlFromBase64(caf.publicKeyExponent);
  const publicKey = createPublicKey({
    key: { kty: "RSA", n: modulusB64, e: exponentB64 },
    format: "jwk",
  });

  const verifier = createVerify("RSA-SHA1");
  verifier.update(toISO88591(ddMatch[0]));
  verifier.end();

  const isValid = verifier.verify(publicKey, frmtMatch[1]!, "base64");
  assert.equal(isValid, true);
});

test("TED.generate rechaza un folio fuera del rango del CAF", async () => {
  const caf = await loadTestCAF();
  assert.throws(() => TED.generate(caf, { ...baseInput(caf), folio: 9999 }), TEDError);
});

test("TED.generate rechaza un RUT emisor que no coincide con el CAF", async () => {
  const caf = await loadTestCAF();
  assert.throws(() => TED.generate(caf, { ...baseInput(caf), issuerRut: "1-9" }), TEDError);
});

test("TED.generate rechaza fechas con formato inválido", async () => {
  const caf = await loadTestCAF();
  assert.throws(() => TED.generate(caf, { ...baseInput(caf), issueDate: "27-08-2026" }), TEDError);
});

test("TED.generate rechaza glosas demasiado largas", async () => {
  const caf = await loadTestCAF();
  const tooLong = "x".repeat(41);
  assert.throws(() => TED.generate(caf, { ...baseInput(caf), firstItemName: tooLong }), TEDError);
});

test("TED.generate escapa caracteres especiales de XML en las glosas", async () => {
  const caf = await loadTestCAF();
  const ted = TED.generate(caf, { ...baseInput(caf), recipientLegalName: 'Cliente "AT&T" <VIP>' });

  assert.match(ted.xml, /Cliente &quot;AT&amp;T&quot; &lt;VIP&gt;/);
});

function base64urlFromBase64(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

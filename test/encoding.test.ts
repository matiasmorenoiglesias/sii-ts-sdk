import { test } from "node:test";
import assert from "node:assert/strict";
import { toISO88591, fromISO88591 } from "../src/encoding.js";

test("toISO88591 codifica tildes y ñ correctamente", () => {
  const text = "Sesión kinesiología, peñíasco eléctrico";
  const buffer = toISO88591(text);

  // 'é' en ISO-8859-1 es 0xE9, 'ñ' es 0xF1
  assert.equal(buffer.includes(0xe9), true);
  assert.equal(buffer.includes(0xf1), true);
});

test("toISO88591 y fromISO88591 son inversas para texto en español", () => {
  const original = "Emisor: Óscar Muñoz, giro: reparación de artículos eléctricos";
  const encoded = toISO88591(original);
  const decoded = fromISO88591(encoded);

  assert.equal(decoded, original);
});

test("fromISO88591 decodifica bytes latin1 conocidos", () => {
  const bytes = Buffer.from([0x4e, 0xf1]); // "Nñ"
  assert.equal(fromISO88591(bytes), "Nñ");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { aISO88591, desdeISO88591 } from "../src/encoding.js";

test("aISO88591 codifica tildes y ñ correctamente", () => {
  const texto = "Sesión kinesiología, peñíasco eléctrico";
  const buffer = aISO88591(texto);

  // 'é' en ISO-8859-1 es 0xE9, 'ñ' es 0xF1
  assert.equal(buffer.includes(0xe9), true);
  assert.equal(buffer.includes(0xf1), true);
});

test("aISO88591 y desdeISO88591 son inversas para texto en español", () => {
  const original = "Emisor: Óscar Muñoz, giro: reparación de artículos eléctricos";
  const ida = aISO88591(original);
  const vuelta = desdeISO88591(ida);

  assert.equal(vuelta, original);
});

test("desdeISO88591 decodifica bytes latin1 conocidos", () => {
  const bytes = Buffer.from([0x4e, 0xf1]); // "Nñ"
  assert.equal(desdeISO88591(bytes), "Nñ");
});

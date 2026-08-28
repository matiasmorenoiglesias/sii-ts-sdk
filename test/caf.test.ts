import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CAF, CAFError } from "../src/domain/caf.js";

const fixturePath = fileURLToPath(new URL("../fixtures/test-caf.xml", import.meta.url));

test("CAF.fromXML parsea los campos del CAF", async () => {
  const buffer = await readFile(fixturePath);
  const caf = await CAF.fromXML(buffer);

  assert.equal(caf.issuerRut, "76123456-7");
  assert.equal(caf.legalName, "EMPRESA DE PRUEBA SPA");
  assert.equal(caf.documentType, "39");
  assert.deepEqual(caf.folioRange, { from: 1, to: 100 });
  assert.equal(caf.authorizedAt, "2025-01-01");
  assert.equal(caf.keyId, "100");
  assert.match(caf.privateKeyPem, /BEGIN RSA PRIVATE KEY/);
});

test("CAF.fromXML expone includesFolio", async () => {
  const buffer = await readFile(fixturePath);
  const caf = await CAF.fromXML(buffer);

  assert.equal(caf.includesFolio(1), true);
  assert.equal(caf.includesFolio(100), true);
  assert.equal(caf.includesFolio(101), false);
  assert.equal(caf.includesFolio(0), false);
});

test("CAF.fromXML rechaza un XML mal formado", async () => {
  await assert.rejects(
    () => CAF.fromXML(Buffer.from("no es xml")),
    CAFError,
  );
});

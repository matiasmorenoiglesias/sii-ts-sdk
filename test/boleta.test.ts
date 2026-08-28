import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CAF } from "../src/domain/caf.js";
import { Boleta, BoletaError, type BoletaInput } from "../src/domain/boleta.js";

const fixturePath = fileURLToPath(new URL("../fixtures/test-caf.xml", import.meta.url));

async function loadTestCAF(): Promise<CAF> {
  const buffer = await readFile(fixturePath);
  return CAF.fromXML(buffer);
}

function baseInput(caf: CAF): BoletaInput {
  return {
    folio: 1,
    issueDate: "2026-08-27",
    issuer: { rut: caf.issuerRut, legalName: "Mi Empresa SpA", businessActivity: "Servicios" },
    recipient: { rut: "66666666-6" },
    items: [{ name: "Sesión kinesiología", quantity: 1, price: 25000 }],
    timestamp: "2026-08-27T10:00:00",
  };
}

test("Boleta.create arma el Documento con los datos básicos", async () => {
  const caf = await loadTestCAF();
  const boleta = Boleta.create(caf, baseInput(caf));

  assert.equal(boleta.totalAmount, 25000);
  assert.equal(boleta.documentType, "39");
  assert.match(boleta.xml, /^<Documento xmlns="http:\/\/www\.sii\.cl\/SiiDte" ID="F1T39">/);
  assert.match(boleta.xml, /<\/Documento>$/);
  assert.match(boleta.xml, /<TipoDTE>39<\/TipoDTE>/);
  assert.match(boleta.xml, /<Folio>1<\/Folio>/);
  assert.match(boleta.xml, /<IndServicio>3<\/IndServicio>/);
  assert.match(boleta.xml, /<RUTEmisor>76123456-7<\/RUTEmisor>/);
  assert.match(boleta.xml, /<RUTRecep>66666666-6<\/RUTRecep>/);
  assert.match(boleta.xml, /<MntTotal>25000<\/MntTotal>/);
  assert.match(boleta.xml, /<NmbItem>Sesión kinesiología<\/NmbItem>/);
  assert.match(boleta.xml, /<MontoItem>25000<\/MontoItem>/);
  assert.match(boleta.xml, /<TED version="1\.0">/);
  assert.match(boleta.xml, /<TmstFirma>2026-08-27T10:00:00<\/TmstFirma>/);
});

test("Boleta.create suma varios ítems para el total y el monto de cada línea", async () => {
  const caf = await loadTestCAF();
  const input = baseInput(caf);
  input.items = [
    { name: "Consulta", quantity: 1, price: 15000 },
    { name: "Insumos", quantity: 3, price: 1000 },
  ];

  const boleta = Boleta.create(caf, input);

  assert.equal(boleta.totalAmount, 18000);
  assert.match(boleta.xml, /<NroLinDet>1<\/NroLinDet><NmbItem>Consulta<\/NmbItem>[^<]*<QtyItem>1<\/QtyItem><PrcItem>15000<\/PrcItem><MontoItem>15000<\/MontoItem>/);
  assert.match(boleta.xml, /<NroLinDet>2<\/NroLinDet><NmbItem>Insumos<\/NmbItem>[^<]*<QtyItem>3<\/QtyItem><PrcItem>1000<\/PrcItem><MontoItem>3000<\/MontoItem>/);
});

test("Boleta.create usa el primer ítem como IT1 del TED", async () => {
  const caf = await loadTestCAF();
  const input = baseInput(caf);
  input.items = [
    { name: "Primer ítem", price: 1000 },
    { name: "Segundo ítem", price: 2000 },
  ];

  const boleta = Boleta.create(caf, input);
  assert.match(boleta.ted.xml, /<IT1>Primer ítem<\/IT1>/);
});

test("Boleta.create rechaza sin ítems", async () => {
  const caf = await loadTestCAF();
  const input = baseInput(caf);
  input.items = [];
  assert.throws(() => Boleta.create(caf, input), BoletaError);
});

test("Boleta.create rechaza un ítem sin precio", async () => {
  const caf = await loadTestCAF();
  const input = baseInput(caf);
  input.items = [{ name: "Sin precio" }];
  assert.throws(() => Boleta.create(caf, input), BoletaError);
});

test("Boleta.create rechaza folio fuera de rango (delega en TED)", async () => {
  const caf = await loadTestCAF();
  const input = baseInput(caf);
  input.folio = 9999;
  assert.throws(() => Boleta.create(caf, input));
});

test("Boleta.create rechaza fecha de emisión con formato inválido", async () => {
  const caf = await loadTestCAF();
  const input = baseInput(caf);
  input.issueDate = "27/08/2026";
  assert.throws(() => Boleta.create(caf, input), BoletaError);
});

test("Boleta.create arma la Referencia cuando se indica", async () => {
  const caf = await loadTestCAF();
  const input = baseInput(caf);
  input.reference = { code: "SET", reason: "CASO-1" };

  const boleta = Boleta.create(caf, input);

  assert.match(boleta.xml, /<Referencia><NroLinRef>1<\/NroLinRef><CodRef>SET<\/CodRef><RazonRef>CASO-1<\/RazonRef><\/Referencia>/);
});

test("Boleta.create no arma Referencia si no se indica", async () => {
  const caf = await loadTestCAF();
  const boleta = Boleta.create(caf, baseInput(caf));

  assert.ok(!boleta.xml.includes("<Referencia>"));
});

test("Boleta.create marca ítems exentos con IndExe y los suma en MntExe", async () => {
  const caf = await loadTestCAF();
  const input = baseInput(caf);
  input.items = [
    { name: "item afecto 1", quantity: 8, price: 1590, exempt: false },
    { name: "item exento 2", quantity: 2, price: 1000, exempt: true },
  ];

  const boleta = Boleta.create(caf, input);

  assert.equal(boleta.totalAmount, 8 * 1590 + 2 * 1000);
  assert.match(boleta.xml, /<MntExe>2000<\/MntExe>/);
  assert.match(boleta.xml, /<NmbItem>item afecto 1<\/NmbItem>/);
  assert.match(boleta.xml, /<IndExe>1<\/IndExe><NmbItem>item exento 2<\/NmbItem>/);
});

test("Boleta.create no arma MntExe si no hay ítems exentos", async () => {
  const caf = await loadTestCAF();
  const boleta = Boleta.create(caf, baseInput(caf));

  assert.ok(!boleta.xml.includes("<MntExe>"));
});

test("Boleta.create informa la unidad de medida cuando se indica", async () => {
  const caf = await loadTestCAF();
  const input = baseInput(caf);
  input.items = [{ name: "Arroz", quantity: 5, price: 700, unitOfMeasure: "Kg" }];

  const boleta = Boleta.create(caf, input);

  assert.match(boleta.xml, /<QtyItem>5<\/QtyItem><UnmdItem>Kg<\/UnmdItem><PrcItem>700<\/PrcItem>/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractReturnValue, parseSiiResponse } from "../src/adapters/soap.js";

class FakeError extends Error {}

test("extractReturnValue encuentra la etiqueta con prefijo de namespace (respuesta real del SII)", () => {
  // El SII a veces devuelve <ns1:getSeedReturn> en vez de <getSeedReturn>
  // sin prefijo, aunque el WSDL no lo sugiera — confirmado contra la
  // respuesta real de maullin.sii.cl.
  const soapXml =
    '<soapenv:Envelope><soapenv:Body>' +
    '<ns1:getSeedResponse xmlns:ns1="http://DefaultNamespace">' +
    '<ns1:getSeedReturn xsi:type="xsd:string">hola</ns1:getSeedReturn>' +
    '</ns1:getSeedResponse></soapenv:Body></soapenv:Envelope>';

  const value = extractReturnValue(soapXml, "getSeedReturn", FakeError);
  assert.equal(value, "hola");
});

test("extractReturnValue sigue funcionando sin prefijo de namespace", () => {
  const soapXml = "<getSeedResponse><getSeedReturn>hola</getSeedReturn></getSeedResponse>";
  const value = extractReturnValue(soapXml, "getSeedReturn", FakeError);
  assert.equal(value, "hola");
});

test("parseSiiResponse preserva ceros a la izquierda en ESTADO (no lo convierte a número)", () => {
  // fast-xml-parser por defecto convierte "00" al número 0, perdiendo el
  // cero — ESTADO="00" (éxito) terminaba comparado como "0" (inválido).
  // Confirmado contra la respuesta real del SII.
  const innerXml =
    "<SII:RESPUESTA><SII:RESP_HDR><ESTADO>00</ESTADO></SII:RESP_HDR>" +
    "<SII:RESP_BODY><SEMILLA>167082076076</SEMILLA></SII:RESP_BODY></SII:RESPUESTA>";

  const { header, body } = parseSiiResponse(innerXml, FakeError);

  assert.equal(header.ESTADO, "00");
  assert.equal(body.SEMILLA, "167082076076");
});

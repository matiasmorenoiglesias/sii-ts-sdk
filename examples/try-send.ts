/**
 * Prueba real de punta a punta contra el ambiente de certificación del
 * SII: crea una boleta, autentica, y la envía. No forma parte del SDK.
 *
 * Requiere certificado digital, CAF y RUT real ya postulados/inscritos
 * ante el SII (ver README y CLAUDE.md). No es un simulacro: esto sí
 * llega al servidor real de maullin.sii.cl.
 *
 * Uso:
 *   1. Completa .env (ver .env.example) — certificado, CAF, resolución.
 *   2. npm run try:send
 */
import { readFile } from "node:fs/promises";
import { Certificate } from "../src/domain/certificate.js";
import { CAF } from "../src/domain/caf.js";
import { Issuer } from "../src/domain/issuer.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name} en .env`);
  }
  return value;
}

const certPath = requireEnv("SII_CERT_PATH");
const certPassword = process.env.SII_CERT_PASSWORD ?? "";
const cafPath = requireEnv("SII_CAF_PATH");
const resolutionDate = requireEnv("SII_RESOLUTION_DATE");
const resolutionNumber = Number(process.env.SII_RESOLUTION_NUMBER ?? "0");
const folio = Number(requireEnv("SII_TEST_FOLIO"));
const recipientRut = requireEnv("SII_TEST_RECIPIENT_RUT");

const certificate = await Certificate.fromP12(await readFile(certPath), certPassword);
const caf = await CAF.fromXML(await readFile(cafPath));

const issuer = new Issuer({
  rut: certificate.issuerRut,
  legalName: process.env.SII_ISSUER_LEGAL_NAME || undefined,
  businessActivity: process.env.SII_ISSUER_BUSINESS_ACTIVITY || undefined,
  certificate,
  environment: "certification",
  resolutionDate,
  resolutionNumber,
});

console.log("issuerRut:", issuer.rut);
console.log("folio autorizado:", caf.includesFolio(folio), `(rango ${caf.folioRange.from}-${caf.folioRange.to})`);

console.log("\nArmando boleta...");
const dte = await issuer.createBoleta({
  caf,
  folio,
  recipient: { rut: recipientRut },
  items: [{ name: "Prueba SDK sii-ts-sdk", quantity: 1, price: 1000 }],
});
console.log("Documento armado y firmado. documentType:", dte.documentType);

console.log("\nAutenticando contra el SII...");
const token = await issuer.authenticate();
console.log("Token obtenido:", token);

console.log("\nEnviando...");
const result = await issuer.send(dte, token);
console.log("Resultado:", result);

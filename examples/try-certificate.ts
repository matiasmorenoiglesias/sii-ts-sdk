/**
 * Prueba local de Certificate.fromP12 contra un certificado real, sin
 * tocar el SII para nada. No forma parte del SDK.
 *
 * Uso:
 *   1. Copia .env.example a .env y completa SII_CERT_PATH (y
 *      SII_CERT_PASSWORD si el .p12/.pfx tiene contraseña).
 *   2. npm run try:certificate
 */
import { Certificate } from "../src/index.js";
import { readFile } from "node:fs/promises";

const certPath = process.env.SII_CERT_PATH;
if (!certPath) {
  throw new Error("Falta SII_CERT_PATH en .env (ruta al .p12/.pfx)");
}

const password = process.env.SII_CERT_PASSWORD ?? "";

const buffer = await readFile(certPath);
const certificate = await Certificate.fromP12(buffer, password);

console.log("issuerRut:", certificate.issuerRut);
console.log("certificatePem (primeras 2 líneas):", certificate.certificatePem.split("\n").slice(0, 2).join(" / "));
console.log("privateKeyPem presente:", certificate.privateKeyPem.includes("BEGIN"));

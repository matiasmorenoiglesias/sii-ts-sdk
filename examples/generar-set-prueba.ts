/**
 * Genera los 5 XML del "Set de Prueba de Boleta Electrónica" para el
 * Paso 3 del proceso de certificación (envío por correo a
 * SII_BE_Certificacion@sii.cl). 100% local — no hace ninguna conexión
 * de red, solo usa el certificado y el CAF reales para firmar.
 *
 * No forma parte del SDK: los 5 casos son específicos del set de
 * pruebas asignado por el SII a este RUT en particular.
 *
 * Uso:
 *   npm run try:set-prueba
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Certificate } from "../src/domain/certificate.js";
import { CAF } from "../src/domain/caf.js";
import { Issuer } from "../src/domain/issuer.js";
import type { CreateBoletaInput } from "../src/domain/issuer.js";
import type { BoletaItem } from "../src/domain/boleta.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en .env`);
  return value;
}

const certificate = await Certificate.fromP12(
  await readFile(requireEnv("SII_CERT_PATH")),
  process.env.SII_CERT_PASSWORD ?? "",
);
const caf = await CAF.fromXML(await readFile(requireEnv("SII_CAF_PATH")));

const issuer = new Issuer({
  // El RUT del emisor es el que autoriza el CAF (la empresa), no
  // necesariamente el del certificado (puede ser el RUT personal del
  // representante legal que firma en nombre de la empresa).
  rut: caf.issuerRut,
  legalName: process.env.SII_ISSUER_LEGAL_NAME || undefined,
  businessActivity: process.env.SII_ISSUER_BUSINESS_ACTIVITY || undefined,
  certificate,
  environment: "certification",
  resolutionDate: requireEnv("SII_RESOLUTION_DATE"),
  resolutionNumber: Number(process.env.SII_RESOLUTION_NUMBER ?? "0"),
});

const recipientRut = requireEnv("SII_TEST_RECIPIENT_RUT");

// Datos exactos del "SII SET DE PRUEBA DE BOLETA ELECTRONICA DE VENTAS Y SERVICIOS"
const cases: Array<{ n: number; items: BoletaItem[] }> = [
  {
    n: 1,
    items: [
      { name: "Cambio de aceite", quantity: 1, price: 19900 },
      { name: "Alineacion y balanceo", quantity: 1, price: 9900 },
    ],
  },
  { n: 2, items: [{ name: "Papel de regalo", quantity: 17, price: 120 }] },
  {
    n: 3,
    items: [
      { name: "Sandwic", quantity: 2, price: 1500 },
      { name: "Bebida", quantity: 2, price: 550 },
    ],
  },
  {
    n: 4,
    items: [
      { name: "item afecto 1", quantity: 8, price: 1590, exempt: false },
      { name: "item exento 2", quantity: 2, price: 1000, exempt: true },
    ],
  },
  { n: 5, items: [{ name: "Arroz", quantity: 5, price: 700, unitOfMeasure: "Kg" }] },
];

const outDir = ".local/boletas-prueba";
await mkdir(outDir, { recursive: true });

for (const { n, items } of cases) {
  const input: CreateBoletaInput = {
    caf,
    folio: n,
    recipient: { rut: recipientRut },
    items,
    reference: { code: "SET", reason: `CASO-${n}` },
  };

  const dte = await issuer.createBoleta(input);
  const path = `${outDir}/caso-${n}.xml`;
  await writeFile(path, dte.xml, "latin1");
  console.log(`CASO-${n}: folio=${n} -> ${path}`);
}

console.log(`\nListo. Adjunta los archivos de ${outDir}/ al correo a SII_BE_Certificacion@sii.cl`);
console.log(`Asunto sugerido: SET DE PRUEBA DE BOLETA ELECTRONICA ${issuer.legalName ?? ""} Rut ${issuer.rut}`);

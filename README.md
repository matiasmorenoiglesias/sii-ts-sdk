# 🧾 sii-ts-sdk

[![Release](https://img.shields.io/github/v/release/matiasmorenoiglesias/sii-ts-sdk?include_prereleases)](https://github.com/matiasmorenoiglesias/sii-ts-sdk/releases/tag/v0.1.1)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![Status](https://img.shields.io/badge/status-en%20certificaci%C3%B3n-yellow)

Librería TypeScript para emitir boletas electrónicas al SII de Chile.

El objetivo es que un dev chileno pueda emitir una boleta sin tener que leer
la documentación del SII. No es un ERP, no es un servicio: es una librería.

> ⚠️ **Estado actual: [v0.1.1](https://github.com/matiasmorenoiglesias/sii-ts-sdk/releases/tag/v0.1.1)
> — funcional a nivel de código, en proceso de certificación real con el
> SII.** El SDK arma, firma, autentica y envía boletas de punta a punta. El
> set de pruebas de certificación ya fue enviado al SII y está en revisión
> (10-15 días hábiles) — ver [`ROADMAP.md`](./ROADMAP.md). Solo opera
> contra el ambiente de **certificación**, nunca producción.

## Alcance

**Dentro:**
- Documentos tipo 39 (boleta afecta) y 41 (boleta exenta)
- Solo ambiente de **certificación** del SII
- Lectura de certificado digital `.p12` y CAF
- Armado del XML del DTE, generación del TED, firma
- Autenticación (semilla → token), envío y consulta de estado
- Resumen de Ventas Diarias (en curso)

**Fuera de alcance:** facturas, notas de crédito/débito, guías de despacho,
ambiente de producción, generación de PDF, persistencia de folios, envío de
correos, CLI, servidor HTTP.

El detalle completo de alcance, convenciones y reglas de este proyecto está
en [`CLAUDE.md`](./CLAUDE.md).

## Instalación

Todavía no está publicado en npm — se publicará ahí cuando el SII confirme
la certificación (ver el estado más arriba). Por ahora se instala directo
desde GitHub, fijando la versión con un tag:

```bash
npm install github:matiasmorenoiglesias/sii-ts-sdk#v0.1.1
```

## Uso

```ts
import { Certificate, CAF, Issuer } from "sii-ts-sdk";
import { readFile } from "node:fs/promises";

const issuer = new Issuer({
  rut: "76123456-7",
  legalName: "Mi Empresa SpA",
  businessActivity: "Servicios",
  certificate: await Certificate.fromP12(await readFile("certificado.p12"), "password"),
  environment: "certification",
  resolutionDate: "2025-01-01", // fecha de la resolución que te autorizó, necesaria para enviar
});

const caf = await CAF.fromXML(await readFile("caf.xml"));

// Arma y firma la boleta (100% local, sin red)
const dte = await issuer.createBoleta({
  caf,
  folio: 1,
  recipient: { rut: "66666666-6" },
  items: [{ name: "Sesión kinesiología", quantity: 1, price: 25000 }],
});

// Autentica contra el SII (semilla → token) y envía
const token = await issuer.authenticate();
const result = await issuer.send(dte, token);

// Consulta de estado, más tarde
const uploadStatus = await issuer.checkUploadStatus(result.trackId!, token);
const dteStatus = await issuer.checkDteStatus(dte, token);
```

Piezas individuales (`Certificate`, `CAF`, `TED`, `Boleta`, `DTE`,
`EnvioBoleta`) también se exportan por si necesitas más control — ver el
código fuente en `src/domain/` para su API completa.

## Documentación adicional

- [`ROADMAP.md`](./ROADMAP.md) — qué está hecho y qué falta, por hito
- [`ONBOARDING.md`](./ONBOARDING.md) — cómo conseguir certificado digital
  y CAF reales para probar contra el ambiente de certificación del SII
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — cómo contribuir al proyecto
- [`CLAUDE.md`](./CLAUDE.md) — alcance, convenciones y reglas del proyecto

## Desarrollo

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # node:test
npm run build        # compila a dist/
```

Los certificados y CAF de `fixtures/` son de prueba, generados localmente —
nunca reales. Ver [`CLAUDE.md`](./CLAUDE.md) para convenciones de código,
arquitectura (ports and adapters) y reglas de nomenclatura.

### Probar contra un certificado/CAF real

Ver [`ONBOARDING.md`](./ONBOARDING.md) para cómo conseguir un certificado
digital y un CAF reales. `examples/` trae scripts que los usan (nunca se
commitean — van en `.local/` y `.env`, ambos ignorados por git). Copia
`.env.example` a `.env` y completa tus datos:

```bash
npm run try:certificate   # lee un .p12/.pfx real y muestra el RUT extraído
npm run try:send          # crea, autentica y envía una boleta real (¡toca la red!)
npm run try:set-prueba    # genera los 5 XML del set de pruebas de certificación
```

## Licencia

[MIT](./LICENSE)

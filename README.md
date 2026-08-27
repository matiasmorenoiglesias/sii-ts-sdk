# 🧾 sii-ts-sdk

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![Status](https://img.shields.io/badge/status-en%20desarrollo-yellow)

Librería TypeScript para emitir boletas electrónicas al SII de Chile.

El objetivo es que un dev chileno pueda emitir una boleta sin tener que leer
la documentación del SII. No es un ERP, no es un servicio: es una librería.

> ⚠️ **Estado actual: en desarrollo temprano, no funcional todavía.**
> Solo está implementada la lectura del certificado digital. Falta CAF,
> armado del DTE, TED, firma y envío. No usar en producción — de hecho,
> este proyecto ni siquiera tocará el ambiente de producción del SII (ver
> alcance más abajo).

## Alcance

**Dentro:**
- Documentos tipo 39 (boleta afecta) y 41 (boleta exenta)
- Solo ambiente de **certificación** del SII
- Lectura de certificado digital `.p12` y CAF
- Armado del XML del DTE, generación del TED, firma
- Autenticación (semilla → token), envío y consulta de estado

**Fuera de alcance:** facturas, notas de crédito/débito, guías de despacho,
ambiente de producción, generación de PDF, persistencia, CLI, servidor HTTP.

El detalle completo de alcance, convenciones y reglas de este proyecto está
en [`CLAUDE.md`](./CLAUDE.md).

## Instalación

```bash
npm install sii-ts-sdk
```

## Uso actual

Por ahora el SDK solo permite leer un certificado digital y extraer la
llave privada, el certificado y el RUT del emisor:

```ts
import { Certificate } from "sii-ts-sdk";
import { readFile } from "node:fs/promises";

const buffer = await readFile("mi-certificado.p12");
const certificate = await Certificate.fromP12(buffer, "mi-password");

certificate.privateKeyPem;  // llave privada del emisor
certificate.certificatePem; // certificado X.509
certificate.issuerRut;      // RUT extraído del certificado
```

## API objetivo

Esta es la interfaz pública hacia la que se está construyendo el SDK:

```ts
const issuer = new Issuer({
  rut: "76123456-7",
  legalName: "Mi Empresa SpA",
  businessActivity: "Servicios",
  certificate: await Certificate.fromP12(buffer, password),
  environment: "certification",
});

const caf = await CAF.fromXML(cafBuffer);

const boleta = await issuer.createBoleta({
  caf,
  folio: 1,
  recipient: { rut: "66666666-6" },
  items: [{ name: "Sesión kinesiología", quantity: 1, price: 25000 }],
});

const token = await issuer.authenticate();
const result = await issuer.send(boleta, token);
```

## Roadmap — Hito 1

El único objetivo por ahora: **una boleta tipo 39 aceptada por el ambiente
de certificación del SII.**

- [x] Lectura de certificado digital `.p12`
- [x] Utilidad de encoding ISO-8859-1
- [ ] Parseo del CAF (archivo de folios)
- [ ] Armado del XML del DTE
- [ ] Generación del TED
- [ ] Firma del DTE
- [ ] Autenticación SOAP (semilla → token)
- [ ] Envío y consulta de estado

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

## Licencia

[MIT](./LICENSE)

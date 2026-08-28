# Roadmap

## Hito 1 — cumplido a nivel de código, en revisión del SII

El SDK arma, firma, autentica y envía una boleta tipo 39 de punta a punta.
El set de pruebas de certificación (5 casos) ya fue enviado al SII para su
aprobación — trámite en curso, fuera del SDK.

- [x] Certificado digital (`.p12`)
- [x] CAF (archivo de folios)
- [x] TED (timbre electrónico)
- [x] Armado del XML del `Documento`/`Boleta`
- [x] Firma XML del DTE (XMLDSig + C14N)
- [x] Sobre `EnvioBOLETA` firmado
- [x] Autenticación SOAP (semilla → token)
- [x] Envío (`DTEUpload`)
- [x] Consulta de estado (`QueryEstUp`/`QueryEstDte`)

## Hito 2 — en curso

- [ ] Resumen de Ventas Diarias (envío diario obligatorio, incluso en $0)

Ver [`CLAUDE.md`](./CLAUDE.md) para el detalle del alcance de cada hito y
la regla de "no avanzar sin conversarlo" al cerrar uno.

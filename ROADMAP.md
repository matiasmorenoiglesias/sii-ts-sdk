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
- [x] Autenticación SOAP (semilla → token) — **verificado contra el SII real**, dos bugs encontrados y corregidos en el proceso (ver commit `bc7cf38`)
- [x] Envío (`DTEUpload`) — código completo, **sin verificar contra el SII real todavía**
- [x] Consulta de estado (`QueryEstUp`/`QueryEstDte`) — código completo, **sin verificar contra el SII real todavía**

## Hito 2 — en curso

- [ ] Resumen de Ventas Diarias (envío diario obligatorio, incluso en $0)

## Difusión

No anunciar públicamente (LinkedIn, X, etc.) hasta que `send()` y la
consulta de estado estén verificados contra el SII real, o hasta que
llegue la confirmación de certificación. `authenticate()` parecía sólido
por los tests con fakes y aun así tenía dos bugs reales — probable que
`send()`, más complejo, tenga sorpresas parecidas. Mejor que el primer
contacto público con el proyecto sea "funciona", no un bug del primer día.

Ver [`CLAUDE.md`](./CLAUDE.md) para el detalle del alcance de cada hito y
la regla de "no avanzar sin conversarlo" al cerrar uno.

## Ideas fuera de alcance de este repo

Cosas que suenan interesantes pero que **no** deberían implementarse
dentro de este SDK — o porque chocan con "es una librería, no un
servicio" (CLAUDE.md), o porque necesitan sus propias decisiones de
seguridad/UX que no le corresponden a una librería. Si alguna se hace
algún día, como proyecto separado que dependa de este SDK:

- **Servidor MCP** para usar el SDK desde Claude Desktop (o similar) y
  que gente no técnica pueda emitir boletas sin pagar un SaaS de
  facturación. Correría local, no como servicio hosteado — eso baja el
  riesgo de manejo de certificados de terceros. Pero como boletas son
  documentos tributarios reales con folios irreversibles, cualquier
  implementación de esto debe exigir confirmación humana explícita del
  contenido exacto antes de cada envío real — nunca dejar que el LLM
  mande una boleta en piloto automático.

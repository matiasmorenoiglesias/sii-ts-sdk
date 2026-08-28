# Onboarding: certificado y CAF para el ambiente de certificación del SII

Antes de poder usar este SDK contra el SII de verdad (aunque sea en
certificación), necesitas dos cosas que **no** puede conseguir el SDK por
ti: un certificado digital y un CAF. Ambos son trámites manuales, por
diseño del SII — no existe una API para ninguno de los dos. Esta guía
resume el camino que seguimos nosotros mismos.

## 1. Certificado digital

Es tuyo — lo compras a una entidad certificadora acreditada por el SII, no
lo entrega el SII.

**Requisito previo:** tener "inicio de actividades" vigente ante el SII,
como contribuyente de primera categoría. Puede ser una persona natural con
RUT propio, no hace falta que sea una empresa.

**Proveedores acreditados** (cualquiera sirve, pide el "Certificado
Digital SII" / "Certificado Tributario", no cualquier firma electrónica
genérica):
- [Acepta](https://acepta.com/)
- [E-CertChile](https://www.ecertla.com/)
- E-Sign

El proceso general: entras al sitio del proveedor, te identificas (Clave
Única o manual), pagas, y te entregan un archivo `.p12`/`.pfx` protegido
con contraseña. Vigencia típica de 1-2 años.

## 2. Postulación como emisor de Boleta Electrónica

**Ojo:** boleta electrónica tiene un proceso de postulación/certificación
**separado** del de Factura Electrónica — son portales distintos. Si
entras al portal general de "Factura Mercado" vas a ver sets de prueba de
factura/guía/notas de crédito, que no son los que necesitas.

El proceso específico de boleta, [documentado acá](https://www.sii.cl/factura_electronica/guia_emitir_boleta_servicio.htm):

1. **Solicitar Set de Prueba**: tu representante legal entra a
   [`https://www4.sii.cl/certBolElectDteInternet/?SET=1`](https://www4.sii.cl/certBolElectDteInternet/?SET=1),
   autenticado con el certificado digital. Te llega el set de prueba (los
   casos que tienes que generar) y las instrucciones por correo.
2. **Revisar formatos**: ya están en [`docs/`](./docs) de este repo
   (`formato_boleta_electronica.pdf`, schema XML, etc.).
3. **Generar y enviar 5 boletas de prueba** por correo a
   `SII_BE_Certificacion@sii.cl`, asunto
   `SET DE PRUEBA DE BOLETA ELECTRONICA <NOMBRE EMPRESA> Rut <RUT>`. Este
   SDK trae un script para generarlas — ver
   [`examples/generar-set-prueba.ts`](./examples/generar-set-prueba.ts).
   Revisión del SII: 10-15 días hábiles.
4. **Declaración de Cumplimiento**, una vez aprobado el paso anterior, en
   [`https://www4.sii.cl/certBolElectDteInternet/`](https://www4.sii.cl/certBolElectDteInternet/).
   Es una declaración legal firmada por el representante legal — revisa
   cada punto con criterio propio, no la llenes solo para destrabar
   pruebas (ver discusión al respecto más abajo).

## 3. CAF (Código de Autorización de Folios)

El CAF **no se pide una sola vez** — cada vez que se te acaban los folios
autorizados, tienes que volver a pedirlo. Es manual, siempre:

1. Entra a **`https://maullin.sii.cl`** (el ambiente de certificación —
   no `www.sii.cl`, ese es producción)
2. Autentícate con tu certificado digital
3. Entra a **"Solicitud de Timbraje Electrónico de Documentos"**
4. Tipo de documento: **39** (Boleta Electrónica). Cantidad: con 5-10
   alcanza para pruebas
5. Descargas un archivo XML — ese es el CAF

No existe una API para este paso. El propio SII lo documenta como
"únicamente a través de nuestro sitio web" — es intencional, para forzar
interacción periódica del contribuyente con el portal.

## 4. Poniéndolo a andar localmente

Ninguno de estos archivos se commitea nunca al repo. Van en `.local/`
(ignorado por git) y se referencian desde `.env`:

```bash
cp .env.example .env
```

Completa `.env` con las rutas a tu `.pfx` y tu CAF real, más los datos de
tu empresa. Después:

```bash
npm run try:certificate   # confirma que el certificado se lee bien
npm run try:set-prueba    # genera los 5 XML del set de pruebas
npm run try:send          # crea, autentica y envía una boleta real
```

## Nota sobre arquitectura con múltiples puntos de venta

Si vas a usar esto con más de una caja/POS, no distribuyas el certificado
ni el CAF a cada terminal — es un problema de seguridad (varias copias de
la llave privada) y de coordinación (dos cajas podrían repetir folio). El
patrón común es un **backend central** que guarda certificado y CAF, y que
los terminales le piden boletas por red interna; el backend es quien
asigna folios sin duplicarlos, guarda los documentos generados, y habla
con el SII. Ese backend es exactamente el rol que cumple este SDK — la
coordinación entre terminales queda del lado de la aplicación que lo usa,
no del SDK (ver alcance en [`CLAUDE.md`](./CLAUDE.md)).

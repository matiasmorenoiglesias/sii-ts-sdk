# CLAUDE.md

## Qué es esto

Librería TypeScript para emitir boletas electrónicas al SII de Chile.
Open source, MIT. El objetivo es que un dev chileno pueda emitir una boleta
sin leer la documentación del SII.

No es un ERP. No es un servicio. Es una librería.

## Alcance

### Dentro

- Documentos tipo 39 (boleta afecta) y 41 (boleta exenta)
- Solo ambiente de **certificación**
- Leer certificado digital .p12 y extraer llave privada y certificado
- Leer CAF (archivo de folios) desde XML
- Armar XML del DTE, generar TED, firmar
- Autenticación: semilla → token
- Envío y consulta de estado

### Fuera — no implementar aunque parezca fácil

- Facturas (33, 34), notas de crédito/débito, guías de despacho
- Ambiente de producción
- Cesión de facturas
- Generación de PDF o representación impresa
- Persistencia de folios, base de datos, ORM
- CLI, servidor HTTP, dashboard
- Cualquier cosa que suene a "y además podríamos..."

Si crees que algo del listado "fuera" hace falta, pregunta antes. No lo agregues.

## Regla más importante

**No inventes el formato del DTE desde memoria.**

El esquema XML, los campos obligatorios, el cálculo del TED y los endpoints
cambian con el tiempo. Antes de implementar cualquier parte del formato:

1. Consulta la documentación oficial vigente del SII sobre formato de
   documentos electrónicos y el instructivo de certificación
2. Si no tienes acceso a esa documentación en el contexto, **detente y pídela**
3. Deja el link o la referencia en un comentario junto al código

Un campo mal nombrado hace que el SII rechace el documento con un error que
no explica nada. Preferimos parar a adivinar.

## Trampas conocidas

Estas son las partes donde se pierde el tiempo. Trátalas con cuidado:

1. **TED**: se firma con la llave que viene dentro del CAF, no con el
   certificado digital del emisor. Son firmas distintas.
2. **Codificación**: el SII trabaja en ISO-8859-1, no UTF-8. Cualquier tilde
   o ñ mal codificada invalida el documento. No asumas UTF-8 en ningún punto
   del pipeline.
3. **Canonicalización XML**: un espacio o salto de línea de más rompe la
   firma. Canonicaliza antes de firmar, no después.
4. **SOAP**: los endpoints de autenticación son viejos. No esperes REST.

## API objetivo

Esta es la interfaz pública. Manténla así salvo que haya una razón fuerte:

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
  items: [
    { name: "Sesión kinesiología", quantity: 1, price: 25000 },
  ],
});

const token = await issuer.authenticate();
const result = await issuer.send(boleta, token);
```

Criterio: se tiene que entender leyéndolo, sin abrir la documentación del SII.

## Convenciones de código

- TypeScript estricto. `strict: true`, sin `any`.
- Dependencias mínimas. Cada una se justifica. Preferir lo que ya trae Node.
- Todo el código en inglés (clases, archivos, carpetas, funciones,
  variables, comentarios técnicos), **excepto** los términos oficiales
  del SII que no tienen equivalente correcto en inglés: `RUT`, `CAF`,
  `DTE`, `Boleta`, `Factura`. Esos se mantienen tal cual, porque son
  nombres legales de documentos/campos específicos — traducirlos
  ("Boleta" → "Receipt") puede confundir cuál documento SII se está
  representando. Ejemplo: `Certificate`, `Issuer`, `CAF` (se mantiene),
  `recipient`, `legalName`, `businessActivity`, `createBoleta` (verbo en
  inglés, sustantivo oficial se mantiene).
- Los mensajes de error dirigidos al desarrollador (texto de las
  excepciones) pueden ir en español — son para el consumidor final de la
  librería, no identificadores de código.
- Patrón ports and adapters para separar dominio de librerías externas:
  el dominio (`src/domain`) define puertos (`src/domain/ports`) que
  consume; las implementaciones concretas con dependencias externas
  (node-forge, cliente SOAP, etc.) viven en `src/adapters` y son
  reemplazables/testeables con fakes sin tocar el dominio.
- Errores tipados y descriptivos. Si el SII rechaza, el mensaje debe decir
  qué campo y por qué, no devolver el XML crudo.
- Sin console.log en la librería.

## Tests

- Tests unitarios para: parseo de CAF, generación de TED, firma,
  codificación ISO-8859-1.
- Fixtures con certificados y CAF de prueba, nunca reales.
- **Nunca commitear** certificados, CAF reales, claves ni RUTs de clientes.
- El test de integración contra certificación va aparte y no corre en CI
  por defecto.

## Hito 1 — lo único que importa ahora

Una boleta tipo 39 aceptada por el ambiente de certificación del SII.

Cuando eso pase, paramos y decidimos qué sigue. No avanzar más allá sin
conversarlo.

## Cómo trabajar

- Cambios chicos e incrementales. Un commit por pieza que funciona.
- Si algo del SII no está claro, decirlo en vez de asumir.
- Si una decisión tiene más de una opción razonable, plantear las opciones
  antes de elegir.
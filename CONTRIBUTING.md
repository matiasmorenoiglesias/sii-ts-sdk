# Contribuir a sii-ts-sdk

Gracias por el interés. Este proyecto tiene un alcance deliberadamente
acotado — antes de escribir código, lee [`CLAUDE.md`](./CLAUDE.md). Define
qué está dentro y fuera de alcance, las convenciones de nomenclatura, la
arquitectura y la regla más importante del proyecto (no inventar el formato
del DTE del SII desde memoria). Esta guía complementa ese documento, no lo
reemplaza.

## Antes de abrir un PR

- **Revisa el alcance.** Si tu cambio no está en la lista "Dentro" de
  `CLAUDE.md` (boleta 39/41, ambiente de certificación), probablemente no
  se va a aceptar. Facturas, notas de crédito/débito, ambiente de
  producción, PDF, persistencia, CLI, servidor HTTP: están explícitamente
  fuera. Si crees que hace falta algo de esa lista, abre un issue para
  discutirlo antes de implementarlo.
- **No inventes formato del SII.** Si tu cambio toca el XML del DTE, el
  CAF, el TED, o cualquier endpoint SOAP, tiene que estar basado en la
  documentación oficial vigente del SII, con la referencia dejada en un
  comentario junto al código. Un PR que adivina un campo se va a rechazar,
  aunque los tests pasen.
- **Cambios chicos.** Un PR por pieza que funciona. Evita PRs que mezclan
  varias cosas no relacionadas.

## Levantar el proyecto

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test             # node:test
npm run build        # compila a dist/
```

Node 20+.

## Arquitectura

El proyecto sigue **ports and adapters**:

- `src/domain/` — lógica de negocio, no importa librerías externas
  directamente
- `src/domain/ports/` — interfaces que el dominio consume
- `src/adapters/` — implementaciones concretas de esas interfaces
  (node-forge, cliente SOAP, etc.)

Si tu cambio agrega una dependencia externa nueva, la integración va en un
adaptador, no en el dominio.

## Convenciones de código

- TypeScript estricto (`strict: true`), sin `any`.
- Dependencias mínimas — cada una se justifica en el PR.
- Todo el código en inglés (clases, archivos, carpetas, funciones,
  variables), **excepto** los términos oficiales del SII sin equivalente
  correcto: `RUT`, `CAF`, `DTE`, `Boleta`, `Factura`. No traduzcas esos.
- Los mensajes de error dirigidos al desarrollador pueden ir en español.
- Errores tipados y descriptivos: si el SII rechaza un documento, el
  mensaje debe decir qué campo y por qué.
- Sin `console.log` en la librería.

## Tests

- Toda pieza nueva necesita test unitario.
- Los fixtures (certificados, CAF) son **siempre** generados/sintéticos,
  nunca reales. **Nunca** commitees un certificado, CAF, llave o RUT real
  — ni de prueba propia ni de un cliente.
- El test de integración contra el ambiente de certificación del SII va
  aparte y no corre en CI por defecto (requiere credenciales reales).

## Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/), en
inglés:

```
feat: parse CAF XML
fix: correct TED signature encoding
docs: update README roadmap
refactor: extract XML canonicalization to adapter
```

Un commit por pieza que funciona — no mezcles refactors con features.

## Pull requests

1. Abre un issue primero si el cambio es no trivial o toca algo de la
   lista "Fuera" de `CLAUDE.md` — evita trabajo descartado.
2. Rama desde `main`, cambios chicos.
3. `npm run typecheck && npm test` deben pasar.
4. Describe en el PR qué problema resuelve y, si toca formato SII, la
   fuente de la documentación que usaste.

## Seguridad

Si accidentalmente commiteaste un certificado, CAF o RUT real, avisa de
inmediato abriendo un issue privado o contactando a los mantenedores — no
basta con un commit que lo borre, hay que rotar el certificado y limpiar
el historial de git.

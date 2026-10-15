# Especificaciones (SDD)

Este proyecto sigue **Spec-Driven Development**: ninguna funcionalidad se programa sin una spec aprobada.

## Flujo de trabajo

1. **Spec** — qué se construye y por qué: historias de usuario, reglas de negocio numeradas y criterios de aceptación en Gherkin.
2. **Revisión** — el dueño del producto aprueba la spec (o pide cambios).
3. **Plan** — `docs/plans/`: tareas pequeñas, ordenadas, con la rama en que se hará cada una.
4. **Tests primero** — los archivos `.feature` se ejecutan como tests; se escriben en rojo antes del código.
5. **Código** — hasta que todo esté en verde.
6. **Merge** — una rama `feat/*` entra a `develop` solo con lint, tipos, tests y build en verde.

## Convenciones

- **Reglas de negocio**: `RN-<MÓDULO>-<NN>`. Módulos: `CAT` catálogo, `OP` operaciones de stock, `AL` alertas, `AN` análisis (torre de control), `RE` respaldo, `UX` experiencia de uso, `SIS` sistema.
- Una regla **nunca se renumera**. Si se elimina, queda escrita tachada con el estado *Retirada*, la fecha y el motivo: `| ~~RN-CAT-07~~ | **Retirada** (2026-10-15): … |`.
- Cada regla tiene **al menos un escenario Gherkin** etiquetado con su id (`@RN-OP-05`) y al menos un test que la verifica.
- Gherkin en español (`# language: es`): `Característica`, `Escenario`, `Dado`, `Cuando`, `Entonces`, `Y`.
- Cambiar una regla = cambiar primero la spec, en su propia rama `docs/*`, y luego el código.
- Los montos se escriben `S/ 12.50`; las cantidades con su unidad: `3 unid.`, `1.5 kg`, `2 L`.

## Índice

| Documento | Contenido |
|---|---|
| [00-vision-y-arquitectura.md](00-vision-y-arquitectura.md) | Problema, usuarios, fases, arquitectura, módulos y lenguaje ubicuo |
| [fase-1/README.md](fase-1/README.md) | Alcance de la Fase 1 (app local en el celular) |
| [fase-1/01-catalogo.md](fase-1/01-catalogo.md) | Productos, categorías, código de barras y fotos |
| [fase-1/02-operaciones.md](fase-1/02-operaciones.md) | Ventas, llegada de mercadería, mermas, conteos y anulaciones |
| [fase-1/03-alertas.md](fase-1/03-alertas.md) | Estados de stock y notificaciones |
| [fase-1/04-torre-de-control.md](fase-1/04-torre-de-control.md) | Ganancias, predicción, lista de compras y tendencias |
| [fase-1/05-respaldo-e-importacion.md](fase-1/05-respaldo-e-importacion.md) | Excel, respaldo, restauración e importación |
| [fase-1/06-experiencia-de-uso.md](fase-1/06-experiencia-de-uso.md) | Diseño para persona mayor, pantallas, responsive y accesibilidad |
| [fase-1/07-calidad.md](fase-1/07-calidad.md) | Estrategia de pruebas, Definition of Done, CI y ramas |
| [fase-1/features/](fase-1/features/) | Criterios de aceptación ejecutables (Gherkin) |
| [../adr/](../adr/) | Decisiones de arquitectura (ADR) |

# ADR-0006 · Specs ejecutables compartidas

**Estado:** Aceptado · 2026-10-15

## Contexto

Se trabaja con SDD: la spec es la fuente de verdad. Si los criterios de aceptación solo están escritos en prosa, el código y la spec se desalinean. Además, en la Fase 2 el backend debe calcular exactamente lo mismo que el celular.

## Decisión

- Los criterios de aceptación se escriben en **Gherkin en español** (`docs/specs/fase-1/features/*.feature`) y se **ejecutan** como tests con Vitest contra los casos de uso (repositorios en memoria y reloj controlado).
- Cada escenario lleva la etiqueta de la regla que prueba (`@RN-OP-05`). Un script verifica que **toda regla de negocio tenga escenario** y que ningún escenario cite una regla inexistente.
- Los cálculos de análisis tienen además **vectores de prueba JSON** (`docs/specs/fase-1/fixtures/`).
- En la Fase 2, el backend ejecuta **los mismos `.feature` y JSON** con `pytest-bdd` y pytest.

## Consecuencias

- ✅ La spec no puede quedar desactualizada sin que falle un test.
- ✅ Frontend y backend quedan obligados a coincidir.
- ⚠️ Los pasos Gherkin deben redactarse de forma consistente; el plan mantiene un vocabulario de pasos.

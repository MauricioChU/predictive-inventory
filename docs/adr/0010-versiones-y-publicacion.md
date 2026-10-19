# ADR-0010 · Versiones y publicación

**Estado:** Aceptado · 2026-10-18

## Contexto

La app se publica en GitHub Pages cada vez que cambia `main`, y el celular de la tienda se actualiza solo (`registerType: 'autoUpdate'`). Hasta la v0.1.0 la versión se decidía caso por caso. Hace falta una regla fija para saber qué número lleva cada entrega, qué cambió y cómo comprobar en el celular qué versión está instalada.

## Decisión

### Numeración: SemVer `MAJOR.MINOR.PATCH`

| Sube | Cuándo | Ejemplo |
|---|---|---|
| **PATCH** | Arreglos y cambios **solo visuales** que no cambian ninguna regla de negocio. | 0.2.0 → 0.2.1 |
| **MINOR** | Una regla de negocio nueva o cambiada (spec), una pantalla o una función nueva. Incluye cambios del formato del respaldo **con** migración automática (RN-RE-05). | 0.2.1 → 0.3.0 |
| **MAJOR** | Un cambio que obliga a la persona a hacer algo o que rompe la compatibilidad: una copia que la app ya no puede abrir, o datos que no se migran solos. | 1.4.2 → 2.0.0 |

- Mientras dure la Fase 1, la serie es **0.x**. La **v1.0.0** es la salida de la Fase 2 (copia en la nube).
- Si una entrega junta cambios de varios tipos, manda el mayor.

### Una versión = un PR de entrega

1. Todo el trabajo entra a `develop` por PR, como siempre ([ADR-0009](0009-flujo-de-ramas-y-ci.md)). Cada PR que cambia algo visible para la tienda agrega una línea en la sección **"Sin publicar"** de `CHANGELOG.md`.
2. Para publicar, se abre una rama `release/vX.Y.Z` desde `develop` con un solo commit `release: vX.Y.Z` que:
   - sube `version` en `frontend/package.json` y `frontend/package-lock.json` (y en `backend/pyproject.toml` cuando el backend esté en producción);
   - convierte "Sin publicar" en `## [X.Y.Z] · AAAA-MM-DD`.
3. PR de `release/vX.Y.Z` a `develop`, y luego PR de `develop` a `main` con el título `release: vX.Y.Z`, los dos con el CI en verde.
4. Al mezclar en `main`: etiqueta anotada `vX.Y.Z` sobre el merge y **GitHub Release** con las notas de esa versión del CHANGELOG (`gh release create vX.Y.Z --notes-file …`).
5. Un arreglo urgente sigue el mismo camino (`fix/*` → `develop` → entrega PATCH). No se hacen commits directos a `main`.

### CHANGELOG

- `CHANGELOG.md` en la raíz, en español, con el formato de *Keep a Changelog*: secciones **Nuevo**, **Cambiado**, **Arreglado** y **Quitado**.
- Se escribe para quien usa la tienda, no para programadores: "Control muestra si ya cubriste el alquiler del local", no "feat(analisis): RN-AN-19". Las reglas se citan entre paréntesis cuando ayudan a rastrear.

### Comprobación en el celular

*Ajustes → Acerca de* muestra la versión de `package.json` (plan 14). Después de publicar, la versión se verifica en Pages y, cuando se pueda, en el celular de la tienda.

## Consecuencias

- ✅ Cada número dice cuánto cambió y el CHANGELOG dice qué, en palabras de la tienda.
- ✅ `main` solo recibe entregas completas y etiquetadas; Pages publica exactamente lo etiquetado.
- ⚠️ Publicar cuesta un PR más (la rama `release/*`). Es deliberado: el número y las notas se revisan antes de llegar al celular.
- ⚠️ `release/*` se agrega a las ramas de trabajo de ADR-0009.

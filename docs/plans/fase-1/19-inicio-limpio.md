# Plan 19 — Inicio limpio y alerta que lleva a Productos (v0.3.0)

> **Para agentes:** una sola rama `feat/inicio-limpio` (worktree `.worktrees/inicio`), un solo implementador. Spec primero (cambia reglas), luego código y pruebas. Leer [ADR-0010](../../adr/0010-versiones-y-publicacion.md).

**Objetivo:** Inicio es para vender. Se quitan de Inicio las tarjetas informativas y la alerta de "se acaban" lleva a *Productos* ya filtrado, no a *Para comprar*.

## Decisiones del dueño (vinculantes)

1. **Inicio muestra solo:** saludo, ganancia y ventas de hoy, la alerta "N productos se acaban" (si hay), los botones *Vender* · *Llegó mercadería* · *¿Necesito comprar?* y el enlace *Historial*. **Se quitan de Inicio:** Resumen del día, recordatorio del local, recordatorio de copia, "Instala la app".
2. **"Instala la app" se retira del todo** (RN-UX-13 queda *Retirada*, 2026-10-19: el dueño no quiere esa tarjeta; instalar sigue posible desde el menú del navegador). Quitar la tarjeta y el código que solo ella usa (`escucharInstalacion`, etc.) si nada más lo usa.
3. **Resumen del día** (RN-AL-09): *Retirada*. Quitar tarjeta, casos de uso y estado (`ultimoResumenDelDiaMostrado`) si no cuesta migración; la ganancia de ayer ya se ve en Control.
4. **Recordatorio del local** (RN-AL-10): ya no va en Inicio ni en el resumen. Se muestra como **una línea dentro de la tarjeta *Alquiler del local* de Control** cuando el pago cae hoy, mañana o pasado mañana (mismos textos), y sigue la **notificación** (RN-AL-11 sin cambios). Se elimina el botón *Entendido* y `recordatorioDelLocalCerradoEl`.
5. **Recordatorio de copia** (RN-RE-06): se mueve a **Ajustes** (aviso en la pantalla o en el detalle del enlace *Guardar copia*: "Hace N días que no guardas una copia"). Mismas condiciones (7 días, 3 sin almacenamiento persistente). Con la copia en la nube (Fase 2) se apaga.
6. **Alerta de Inicio** (RN-AL-06a): mismo conteo (agotados + por acabarse), texto "N productos se acaban" con detalle "1 agotado y 3 por acabarse", botón **"Ver productos"** que abre `/productos?estado=se-acaban`.
7. **Productos gana un filtro "Se acaban"** (agotados + queda poco), junto a Todos · Queda poco · Agotados · Archivados; se selecciona con `?estado=se-acaban`. El orden de la lista y el resto del comportamiento no cambian.
8. **Notificación de varios avisos de stock** (RN-AL-07): al tocarla abre `/productos?estado=se-acaban` (antes *Para comprar*). Las de un solo producto siguen abriendo su detalle.
9. **Para comprar** sigue en Control igual que hoy; solo deja de enlazarse desde Inicio y desde la notificación.

## Spec (primero, mismo PR)

Editar `docs/specs/fase-1/{03-alertas,05-respaldo-e-importacion,06-experiencia-de-uso,01-catalogo}.md` y los `.feature` afectados. Reglas retiradas quedan tachadas con fecha y motivo (no se renumera): `| ~~RN-AL-09~~ | **Retirada** (2026-10-19): … |`. Reglas cambiadas: RN-AL-06, RN-AL-07, RN-AL-10, RN-RE-06, y la de filtros de Productos en 01 (buscar con `grep -n "Queda poco" docs/specs/fase-1/01-catalogo.md`; si el filtro no tiene regla, agregar la siguiente `RN-CAT-NN` libre). Actualizar el boceto de Inicio y la pantalla Productos en 06. Cada regla vigente conserva al menos un escenario `@RN-…` y los escenarios de reglas retiradas se borran. `npm run verificar-specs` debe pasar.

## Código y pruebas

- Pruebas primero (rojo → verde). Tocar solo lo necesario; borrar el código muerto que deje cada retiro (casos de uso, estado global, `InicioDeLaApp`, pasos Gherkin, fixtures).
- `vocabulario.spec.ts`: recontar escenarios y pickles reales; no puede haber pasos sin uso.
- `e2e/`: actualizar los que miraban las tarjetas retiradas, el botón de la alerta y la notificación; agregar un E2E del camino alerta → Productos filtrado → lista con solo agotados y queda poco. El barrido (`pantallas-de-la-app.ts`) sigue cubriendo todas las rutas.
- Verificación al cerrar, en `frontend/`, cada una con su código de salida: `npm run lint:ci`, `npm run type-check`, `GHERKIN_ESTRICTO=1 npx vitest run --maxWorkers=2`, `npm run verificar-specs`, `npm run build`, `PUERTO_E2E=5183 npx playwright test --workers=2`.
- `CHANGELOG.md` en `## Sin publicar`: **Cambiado** ("Inicio queda solo para vender: se quitaron el resumen del día, el recordatorio del local, el aviso de copia y el de instalar la app." · "Cuando algo se acaba, el aviso te lleva a Productos ya filtrado.") y **Nuevo** ("En Productos puedes filtrar por «Se acaban»." · "El aviso de copia ahora está en Ajustes." · "El recordatorio del pago del local se ve en la tarjeta de Control.").

## Entrega

La hace el controlador: PR a `develop`, CI en verde, `release/v0.3.0` (ADR-0010), PR a `main`, etiqueta y GitHub Release.

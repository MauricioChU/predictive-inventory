# Plan 20 — Panel de venta e Inicio más simple (v0.4.0)

> **Para agentes:** una rama `feat/vender-panel` (worktree `.worktrees/vender`), un implementador. Spec primero (hay una regla retirada y otras cambiadas), luego pruebas y código. Leer [ADR-0010](../../adr/0010-versiones-y-publicacion.md) y la guía de experiencia 06 (letra grande, objetivos ≥ 48/56 px, sin gestos ocultos RN-UX-05, TalkBack RN-UX-15).

## Inicio (cambios chicos, solo visuales)

- La fecha va en **MAYÚSCULAS** ("LUNES 19 DE OCTUBRE") y **se quita la hora** (el celular ya la muestra). `FechaYHora.vue` pasa a ser solo fecha (renombrar si conviene); sin intervalo, pero que cambie al pasar la medianoche si la app sigue abierta (puede revisarse al volver a enfocar la pestaña, `visibilitychange`).
- Saludo: **sin emoji, sin "Hola"**, el nombre de la tienda en **MAYÚSCULAS** (CSS `text-transform` o `toLocaleUpperCase('es')`; el nombre guardado no cambia). Si no hay nombre, no mostrar nada raro.
- Botón **Ajustes**: solo el ícono de la tuerca, con nombre accesible "Ajustes" (`aria-label`) y zona táctil ≥ 48 px. Es una excepción deliberada a RN-UX-04 (íconos con texto): documentarla en esa regla.

## Vender: panel de venta

**Flujo.** La pantalla inicial queda como está (buscador, "Más vendidos", resultados) pero **sin la sección "En esta venta"**. Al agregar el primer producto sube desde abajo el **panel de venta**, que no tapa la grilla (el contenido de la página deja espacio abajo para poder seguir eligiendo).

**Panel, dos estados** (en celular, < 1024 px):
1. **Compacto** (por defecto): cabecera "En esta venta · N producto(s)" con una flecha/indicador y botón de texto *Ver detalle*, el **total** en grande y el botón principal **Confirmar venta** (ancho completo, 56 px). Confirmar desde aquí registra la venta con *Ahora*.
2. **Expandido** (al tocar la cabecera o *Ver detalle*; se cierra con *Cerrar* / la misma cabecera): sube hasta cubrir la pantalla salvo un margen, con:
   - cada **línea**: foto/ícono, nombre, − / + (y cantidad escrita), precio de línea, botón *Quitar* (con *Deshacer* como hoy), y **"Quedan N unid." = stock actual − cantidad en la venta**, actualizado al cambiar la cantidad en el mismo momento; si la cantidad deja el stock en 0 dice "Se acaba"; si la cantidad pasa el stock, mantiene el error y la regla existente (RN-OP-04/stock insuficiente) sin cambios;
   - **¿Cuándo fue la venta?** *Ahora* / *Otro día* (el componente existente, sin cambios de regla);
   - el total y **Confirmar venta**.
- Si se quitan todas las líneas, el panel baja y desaparece. Tras confirmar: pantalla de éxito con ✓ y *Deshacer* (10 s) como hoy, y vuelve a Vender vacío.
- **Se eliminan:** la pantalla "Cobrar", "¿Con cuánto paga?", los botones de billetes, el campo "Paga con" y el **vuelto**. La regla **RN-OP-13 queda *Retirada*** (2026-10-19: el dueño no usa el vuelto en la app). HU-OP-02 se retira. Borrar el código muerto (selector de billetes, cálculo del vuelto, rutas/pantalla de cobro si ya no se usan, pasos Gherkin, fixtures).
- **PC (≥ 1024 px):** se mantiene el carrito a la derecha (buscador a la izquierda) con el mismo contenido que el panel expandido, sin el cobro con vuelto y con *Confirmar venta*. No hace falta el panel deslizable.
- **Accesibilidad:** el panel es una región con nombre ("En esta venta"); abrir/cerrar con botón (no gestos); al expandirse el foco pasa a su título y al cerrar vuelve al botón que lo abrió; `aria-expanded` en la cabecera; los cambios de total/cantidad se anuncian con el mecanismo `aria-live` que ya usa el carrito; respeta "reducir movimiento" (sin animación si está activo); sin scroll horizontal de 320 a 1920 px y con letra Muy grande.
- **Diseño:** coherente con los componentes y tokens existentes (`BarraDeTotal`, `FilaDeCarrito`, `DisposicionDeCarrito`, `CuandoFue`, `Tarjeta`); borde superior redondeado, sombra suave, fondo de superficie; el panel compacto mide lo mínimo (≈ 120–140 px con letra Grande) y sube con una transición corta.
- **Recibir (Llegó mercadería) no cambia** en este plan. Si comparte componentes con Vender (carrito, barra de total), los cambios no deben alterar su comportamiento; sus pruebas siguen verdes.

## Spec (primero, mismo PR)

`docs/specs/fase-1/02-operaciones.md`: retirar RN-OP-13 (tachada, con fecha y motivo, sin renumerar) y HU-OP-02; quitar el vuelto del ejemplo; actualizar el flujo de Vender si la spec lo describe. `06-experiencia-de-uso.md`: pantallas Inicio y Vender (bocetos nuevos), la pantalla Cobrar fuera, excepción de RN-UX-04 para la tuerca. Agregar regla nueva **RN-OP-22** (siguiente libre): "**Panel de venta**: al agregar el primer producto aparece el panel con el total y *Confirmar venta*; cada línea muestra cuántas unidades quedan tras la venta (stock − cantidad) en tiempo real; *¿Cuándo fue la venta?* está en el panel expandido; confirmar registra la venta con *Ahora* salvo que se haya elegido *Otro día*". Escenarios `@RN-OP-22` (quedan N, se acaba, confirmar desde el compacto, Otro día) en `operaciones.feature`; borrar los escenarios del vuelto; `07-calidad.md` RN-SIS-05 deja de decir "vender con vuelto" (decir "vender con panel de venta"). `npm run verificar-specs` verde.

## Pruebas y verificación

- Rojo → verde. Unit/pantalla del panel (compacto, expandido, quedan, quitar, cantidades, error de stock, Otro día, desktop), E2E de vender completo en celular (360×740) y en PC, actualizar E2E que usaban Cobrar/vuelto, barrido 320/Muy grande con el panel abierto y cerrado, axe sin violaciones.
- **Capturas** (Playwright, 360×740, datos de ejemplo sembrados con los casos de uso): `vender-grilla.png`, `vender-panel-compacto.png`, `vender-panel-expandido.png`, `inicio-nuevo.png` en `C:/Users/WinterOS/AppData/Local/Temp/claude/c--Users-WinterOS-Desktop-PAPITO/db447e1b-0418-4ac1-966c-9cc7d0b4fdf9/scratchpad/` (el controlador las revisa).
- En `frontend/`, con código de salida cada una: `npm run lint:ci`, `npm run type-check`, `GHERKIN_ESTRICTO=1 npx vitest run --maxWorkers=2`, `npm run verificar-specs`, `npm run build`, `PUERTO_E2E=5185 npx playwright test --workers=2`.
- `CHANGELOG.md` en `## Sin publicar`: **Cambiado** ("Vender: al elegir un producto sube un panel con lo que llevas, cuánto queda de cada uno y el botón para confirmar." · "Inicio muestra la fecha en mayúsculas y el nombre de tu tienda sin saludo; Ajustes queda solo con la tuerca.") y **Quitado** ("Ya no se calcula el vuelto ni se pregunta con cuánto pagan.").

## Entrega

La hace el controlador (PR a `develop`, `release/v0.4.0`, `main`, etiqueta y Release).

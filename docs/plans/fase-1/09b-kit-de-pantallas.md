# Plan 09b — Kit de componentes de pantalla (antes de la Ola 4)

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Leer [00-plan-maestro.md](00-plan-maestro.md) y [06-experiencia-de-uso.md](../../specs/fase-1/06-experiencia-de-uso.md). Cargar `anthropic-skills:frontend-design-pro`. Se desarrolla **en paralelo** con la rama de composición: solo toca `src/shared/ui/**`.

**Objetivo:** las piezas visuales que comparten las pantallas de la Ola 4, construidas una vez, accesibles, probadas y coherentes con la UI base (tokens, `BotonPrincipal`, `CampoNumero`, `InsigniaEstado`, etc.). Son **componentes de presentación**: reciben datos por props y emiten eventos; **no** llaman casos de uso, ni `useAplicacion()`, ni repositorios.

**Ramas (en paralelo):** `feat/ui-kit-productos` (kit A) y `feat/ui-kit-paneles` (kit B). Cada componente en `src/shared/ui/componentes/` con su test en `src/shared/ui/__tests__/`. Utilidades puras en `src/shared/ui/` (p. ej. `etiquetas-de-dia.ts`). No tocar `src/app/**`, `src/router/**`, `src/main.ts`, `src/modules/**`.

## Reglas comunes

- Textos en español de la spec; montos y cantidades **ya formateados** por quien usa el componente (props `texto…`) o con `@/shared/domain/formato` si el componente recibe `Dinero`/`Cantidad`.
- RN-UX-01..05, 09, 15: rem para tipografía, objetivos ≥ 48 px, primarios ≥ 56 px, ícono + texto, foco visible, nombres accesibles, sin gestos, sin scroll horizontal a 320 px con letra Muy grande.
- Cada componente: test de comportamiento (Vitest + Vue Test Utils) **y** una entrada en una página de catálogo solo para pruebas (`src/shared/ui/__catalogo__/CatalogoDeComponentes.vue`), montada por el gancho de pruebas existente (`window.__pruebas`, mismo patrón que `mostrarGrafico`) para que un E2E (`e2e/kit-de-pantallas.spec.ts`) verifique responsive (320/360/768/1280 × Muy grande) y axe sin violaciones graves.
- Sin dependencias nuevas salvo que sea imprescindible (justificar).

## Kit A — `feat/ui-kit-productos`

| Componente | Props / eventos | Comportamiento |
|---|---|---|
| `FotoDeProducto` | `imagen?: Blob \| string`, `nombre: string`, `categoria?: string`, `tamano: 'chica' \| 'mediana' \| 'grande'` | Crea/revoca `URL.createObjectURL` para Blob; `alt` = nombre; sin foto → ícono de la categoría (mapa nombre de categoría → ícono lucide, con uno genérico) con `aria-hidden` y nombre accesible en el contenedor. Proporción cuadrada, `object-fit: cover`. |
| `TarjetaDeProducto` | `nombre`, `imagen?`, `categoria?`, `textoStock`, `textoPrecio?`, `estado?: EstadoVisual`, `textoSecundario?` (p. ej. "Se acaba en ~4 días"); emite `elegir` | Fila táctil completa (≥ 64 px), foto mediana, nombre en 2 líneas como máximo sin cortar palabras, `InsigniaEstado` si hay estado. Un solo botón accesible con nombre = nombre del producto + stock. |
| `BuscadorGrande` | `modelValue: string`, `etiqueta: string`, `marcador?: string`; emite `update:modelValue` (con espera de 200 ms) y `limpiar` | Input grande con ícono de lupa, botón "Borrar" de 48 px cuando hay texto, `inputmode="search"`, `enterkeyhint="search"`, autofoco opcional. |
| `ListaDeProductos` | `productos: {id, …props de TarjetaDeProducto}[]`, `vacio: { titulo, descripcion?, accion? }`; emite `elegir(id)`, `accion` | Lista accesible (`role="list"`); estado vacío con `EstadoVacio`. |
| `AccesosRapidos` | `productos: {id, nombre, imagen?}[]` (máx. 8); emite `elegir(id)` | Grilla de botones con foto y nombre (2 columnas en 320–599 px, 4 desde 600 px). |
| `FilaDeCarrito` | `nombre`, `imagen?`, `unidad`, `cantidad: string` (v-model), `textoPrecio`, `textoImporte`, `precioEditable?: boolean`, `textoPrecioEspecial?`; emite `update:cantidad`, `cambiarPrecio`, `quitar` | Usa `CampoNumero` (decimales según unidad); botón "Quitar" visible (no deslizar); "Cambiar precio" abre la edición en línea. |
| `BarraDeTotal` | `etiqueta` ("Total"), `textoTotal`, `textoAccion` ("Cobrar"), `deshabilitado?`; emite `accion` | Barra pegada abajo del contenido (sticky dentro de la columna, por encima del pie global usando `--alto-pie`), total en letra grande + `BotonPrincipal`. |
| `SelectorDeBilletes` | `textoTotal`, `billetes: { etiqueta, valor }[]`, `modelValue: string` (pagado); emite `update:modelValue`, `exacto` | Botones S/ 10 · 20 · 50 · 100 · Exacto (≥ 56 px), campo de monto con `CampoNumero` decimal; muestra el mensaje que recibe por prop `mensaje` ("Vuelto S/ 5.37" / "Faltan S/ 4.63") con `aria-live`. |
| `CampoFoto` | `modelValue?: Blob \| null`, `etiqueta`; emite `update:modelValue`, `error` | Botones "Tomar foto" (`capture="environment"`) y "Elegir de la galería"; vista previa con `FotoDeProducto`; "Quitar foto". El procesamiento (reducir) lo hace quien lo usa. |

## Kit B — `feat/ui-kit-paneles`

| Componente / utilidad | Props / eventos | Comportamiento |
|---|---|---|
| `SelectorSegmentado` | `opciones: { valor, etiqueta }[]`, `modelValue`; emite `update:modelValue` | `role="radiogroup"`, flechas mueven la selección, cada opción ≥ 48 px, la seleccionada con fondo + borde + negrita (no solo color). Se envuelve en dos filas si no cabe. |
| `BotonesDeOpcion` | `opciones: { valor, etiqueta, icono? }[]`, `modelValue`, `etiqueta`; emite `update:modelValue` | Opciones grandes en columna (motivos de merma, unidades): radiogroup accesible. |
| `TarjetaDeCifra` | `titulo`, `textoValor`, `textoDetalle?`, `tono?: 'normal' \| 'exito' \| 'peligro'` | Cifra grande ("Hoy ganaste S/ 48.20"); el tono nunca es la única señal (el texto lo dice). |
| `AvisoEnPagina` | `tono: 'atencion' \| 'info' \| 'exito'`, `titulo`, `texto?`, `textoAccion?`; emite `accion`, `cerrar?` | Banner con ícono + texto + botón (p. ej. "4 productos se acaban · Ver qué comprar", recordatorio de copia, resumen del día con "Cerrar"). |
| `ListaAgrupadaPorDia` | `grupos: { dia: Dia, items: T[] }[]` + slot por ítem; utilidad `etiquetaDeDia(dia, hoy)` → "Hoy" / "Ayer" / "Lunes 12" / "12/10/2026" (más de 7 días) | Encabezados `h2` por grupo; lista semántica. |
| `BarraDeProgreso` | `actual`, `total`, `texto` ("Llevas 1 de 3") | `role="progressbar"` con `aria-valuenow/max`; barra gruesa con contraste ≥ 3:1. |
| `MensajeDeError` | `mensaje`, `ayuda?` | Caja con ícono de alerta, el mensaje del dominio tal cual y una línea de ayuda ("Cambia la cantidad o registra la llegada de mercadería."), `role="alert"`. |
| `FilaDeDato` | `etiqueta`, `textoValor`, `destacado?` | Par etiqueta/valor que se apila en 320 px sin desbordar (para detalles de producto, operación, resumen de copia). |
| `RespuestaGrande` | `texto`, `tono` | Frase de "¿Necesito comprar?" en letra muy grande y alto contraste, anunciada con el anunciador global al cambiar. |

## Verificación y entrega (cada rama)

`npm run format && npm run lint:ci && npm run type-check && npm run test:cobertura && npm run build-only && npm run verificar-specs && npx playwright test`. Revisión (spec + calidad) y **PR a `develop`** con los 4 checks del CI.

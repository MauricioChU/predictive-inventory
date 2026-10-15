# 06 · Experiencia de uso

La app la usa principalmente una **persona mayor en un celular Android**. Cada decisión de diseño se mide contra esa persona: vista cansada, dedos menos precisos, poca paciencia con lo técnico y miedo a "malograr algo".

Criterios ejecutables: pruebas E2E y de accesibilidad descritas en [07-calidad.md](07-calidad.md).

## Principios

1. **Una acción principal por pantalla**, grande y abajo, al alcance del pulgar.
2. **Nada se pierde por un toque equivocado**: todo se puede deshacer o se confirma con un resumen claro.
3. **Se lee sin lentes**: letra grande por defecto y alto contraste.
4. **Se entiende sin explicaciones**: íconos siempre con texto y palabras de la tienda.
5. **Nunca un callejón sin salida**: siempre hay un botón "Volver" visible y un mensaje que dice qué hacer.

## Reglas de experiencia

| Id | Regla |
|---|---|
| **RN-UX-01** | **Tamaño de letra** configurable: Normal (18 px), **Grande (20 px, por defecto)** y Muy grande (24 px). Todo el diseño escala con esa base. |
| **RN-UX-02** | **Zonas táctiles** de al menos **48 × 48 px**; los botones de acción principal miden al menos **56 px** de alto y ocupan todo el ancho en celular. Separación mínima de 8 px entre elementos tocables. |
| **RN-UX-03** | **Contraste** mínimo 7:1 para texto normal y 4.5:1 para texto grande e íconos (WCAG AAA para texto). |
| **RN-UX-04** | **Íconos siempre acompañados de texto.** El color nunca es la única señal (RN-AL-05). |
| **RN-UX-05** | **Sin gestos ocultos**: nada depende de deslizar, mantener presionado ni doble toque. Todo tiene un botón visible. |
| **RN-UX-06** | **Números fáciles**: los campos de cantidad y precio abren el teclado numérico y tienen botones **− / +** grandes. Se aceptan coma o punto como separador decimal. |
| **RN-UX-07** | **Mensajes en lenguaje simple**, en tono amable y de "tú". Los errores dicen **qué pasó y qué hacer**, nunca un código técnico: "Solo quedan 2 unid. de Lejía 1 L. Cambia la cantidad o registra la llegada de mercadería." |
| **RN-UX-08** | **Confirmaciones solo donde hay riesgo** (restaurar respaldo, archivar con stock, precio con pérdida). Lo demás se registra directo y ofrece **Deshacer** (RN-OP-18). |
| **RN-UX-09** | **Responsive real**: ninguna pantalla tiene desplazamiento horizontal entre **320 px y 1920 px** de ancho, en vertical y horizontal, y con la letra en *Muy grande*. |
| **RN-UX-10** | **Estados vacíos útiles**: cada lista vacía explica por qué y ofrece la acción siguiente ("Aún no tienes productos. **Agregar el primero**"). |
| **RN-UX-11** | **Retroalimentación inmediata**: cada operación muestra una confirmación visible (pantalla verde con ✓ y el resumen) y una vibración corta si el celular la permite. |
| **RN-UX-12** | **Navegación fija** con 5 destinos, ícono y texto: **Inicio · Vender · Recibir · Productos · Control**. En celular va abajo; desde 1024 px, a la izquierda. *Ajustes* e *Historial* se abren desde Inicio. |
| **RN-UX-13** | **Instalación guiada**: si la app se abre en el navegador sin instalar, Inicio muestra una tarjeta "Instala la app en tu celular" con el botón de instalar (o los pasos, si el navegador no lo ofrece). |
| **RN-UX-14** | **Sin internet no hay diferencia**: ninguna pantalla muestra errores de conexión en la Fase 1, y la app abre y funciona completa en modo avión. |
| **RN-UX-15** | **Accesible**: navegable con lector de pantalla (TalkBack): cada control tiene nombre, los avisos importantes se anuncian (`aria-live`), el orden de foco es lógico y se respeta "reducir movimiento" del sistema. |

## Pantallas

### Inicio
```
┌──────────────────────────────┐
│ Hola 👋  Bodega Rosita   ⚙   │
│ ┌──────────────────────────┐ │
│ │ Hoy ganaste  S/ 48.20    │ │
│ │ Vendiste     S/ 162.50   │ │
│ └──────────────────────────┘ │
│ ┌ 🟠 4 productos se acaban ┐ │
│ │      Ver qué comprar  ›  │ │
│ └──────────────────────────┘ │
│ [ 🛒  VENDER               ] │
│ [ 📦  LLEGÓ MERCADERÍA     ] │
│  Historial ›                 │
├──────────────────────────────┤
│ Inicio Vender Recibir Prod. Control │
└──────────────────────────────┘
```

### Vender
1. Buscar (campo grande arriba, con botón **Escanear**) → resultados con foto, nombre, precio y stock.
2. Tocar un producto lo agrega con cantidad 1; aparecen − / + grandes.
3. Abajo, fijo: **Total S/ 14.63** y botón **Cobrar**.
4. Cobrar: botones de billetes (S/ 10 · 20 · 50 · 100 · Exacto) o monto escrito → **Vuelto S/ 5.37** → **Confirmar venta**.
5. Pantalla de éxito con ✓, resumen y **Deshacer** (10 s) → vuelve a Vender vacío.

### Recibir (Llegó mercadería)
Igual que Vender, pero cada línea muestra **costo** editable en lugar del precio de venta. Se puede abrir prellenada desde *Para comprar*.

### Productos
Lista con buscador, filtros por categoría y por estado (Todos · Queda poco · Agotados · Archivados). Cada fila: foto, nombre, **stock con unidad**, estado (color + ícono + texto). El **detalle** muestra: stock, "se acaba en ~N días", precios y ganancia por unidad, tendencia de 8 semanas, últimos movimientos y botones *Editar*, *Contar stock*, *Registrar merma*, *Archivar*.

### Control (Torre de control)
Tarjetas apiladas en el orden de [04](04-torre-de-control.md); desde 768 px en dos columnas.

### Historial
Operaciones agrupadas por día ("Hoy", "Ayer", "Lunes 12"), con filtro por tipo. Tocar una muestra el detalle y el botón **Anular**.

### Ajustes
Datos de la tienda, días entre compras, días de anticipación, tamaño de letra, notificaciones, categorías, **Guardar copia**, **Restaurar copia**, **Exportar a Excel**, **Importar productos**, **Revisar datos** y *Acerca de* (versión).

### Primera vez
1. Bienvenida → 2. Nombre de la tienda → 3. Tamaño de letra (con vista previa) → 4. "¿Cómo quieres cargar tus productos?": *Uno por uno* o *Desde Excel* → Inicio.

## Responsive

| Ancho | Diseño |
|---|---|
| 320–599 px (celular) | Una columna, navegación abajo, botón principal fijo abajo. |
| 600–1023 px (celular grande / tablet) | Una columna más ancha (máx. 720 px); Control en dos columnas desde 768 px. |
| ≥ 1024 px (PC) | Navegación lateral; Vender y Recibir con buscador a la izquierda y carrito a la derecha; contenido máx. 1200 px. |

Se diseña **primero para 360 px** (el ancho más común en Android) y se verifica en 320 px.

## Guía de palabras

| Usar | Evitar |
|---|---|
| Llegó mercadería | Registrar ingreso / entrada |
| Se dañó · Se derramó · Se venció | Merma (en pantalla) |
| Contar stock | Ajuste de inventario |
| Queda poco · Agotado · Bien | Stock crítico / bajo umbral |
| Se acaba en ~4 días | Cobertura de 4 días |
| Guardar copia | Backup / exportar JSON |
| Deshacer · Anular | Revertir / rollback |

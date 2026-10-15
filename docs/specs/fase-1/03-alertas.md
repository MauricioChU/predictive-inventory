# 03 · Alertas y notificaciones

Cuándo y cómo avisar que un producto se está acabando.

Criterios de aceptación ejecutables: [features/alertas.feature](features/alertas.feature)

## Historias de usuario

| Id | Historia |
|---|---|
| HU-AL-01 | Como usuario principal quiero **ver de un vistazo qué se está acabando**, con color, ícono y texto. |
| HU-AL-02 | Como usuario principal quiero que el celular **me avise** cuando un producto se acaba o está por acabarse. |
| HU-AL-03 | Como usuario principal quiero que los avisos **no se repitan** a cada rato por el mismo producto. |
| HU-AL-04 | Como usuario principal quiero un **resumen al empezar el día**. |

## Estados de stock

| Estado | En pantalla | Condición |
|---|---|---|
| `AGOTADO` | 🔴 **Agotado** | stock = 0 |
| `POR_ACABARSE` | 🟠 **Queda poco** (y, si hay predicción, "se acaba en ~N días") | stock > 0 **y** (stock ≤ stock mínimo **o** días de cobertura ≤ días de anticipación) |
| `NORMAL` | 🟢 **Bien** | en otro caso |

*Días de cobertura* y *venta promedio diaria* se definen en [04-torre-de-control.md](04-torre-de-control.md) (RN-AN-04 y RN-AN-05). Si el producto aún no tiene predicción, solo se usa el stock mínimo.

## Reglas de negocio

| Id | Regla |
|---|---|
| **RN-AL-01** | Cada producto activo tiene exactamente un **estado de stock**, calculado según la tabla anterior. Los productos archivados no tienen estado ni generan avisos. |
| **RN-AL-02** | El estado se **re-evalúa** después de cada operación, al cambiar el stock mínimo o la configuración, y al abrir la app (la predicción cambia con los días aunque no haya ventas). |
| **RN-AL-03** | Se genera un **aviso** solo cuando el estado **empeora**: `NORMAL → POR_ACABARSE`, `NORMAL → AGOTADO` o `POR_ACABARSE → AGOTADO`. Mientras el estado no mejore, no se repite el aviso del mismo producto. |
| **RN-AL-04** | Cuando el estado de un producto **vuelve a `NORMAL`** (por ejemplo, llegó mercadería), el aviso se **rearma**: si vuelve a empeorar, se avisa de nuevo. |
| **RN-AL-05** | El color **nunca es la única señal**: cada estado se muestra con color, ícono y texto. |
| **RN-AL-06** | **Canales en Fase 1**: (a) aviso en Inicio con la cantidad de productos agotados y por acabarse; (b) número en el botón *Control* de la navegación; (c) **notificación del sistema** del celular, si el usuario dio permiso. |
| **RN-AL-07** | Si varios avisos nacen a la vez (por ejemplo, al abrir la app), se agrupan en **una sola notificación**: "3 productos se están acabando". Tocarla abre la lista *Para comprar*. |
| **RN-AL-08** | El **permiso de notificaciones** nunca se pide al abrir la app por primera vez. Se pide desde una pantalla que explica para qué sirve, con botón "Sí, avísame". Si se rechaza, la app funciona igual con avisos internos, y Ajustes explica cómo activarlas. |
| **RN-AL-09** | **Resumen del día**: la primera vez que se abre la app cada día se muestra una tarjeta con productos agotados, productos por acabarse y la ganancia de ayer. Se cierra con un toque y no vuelve a salir ese día. |

## Textos de los avisos

| Situación | Texto |
|---|---|
| Un producto pasa a *Por acabarse* | `Queda poco: <nombre> (<stock>)` y, si hay predicción, `Queda poco: <nombre> (<stock>, se acaba en ~N días)` |
| Un producto pasa a *Agotado* | `Se acabó: <nombre>` |
| Varios avisos a la vez | `N productos se están acabando` |

Las cantidades usan singular o plural según corresponda: "Solo queda 1 kg", "Solo quedan 2 unid.".

## Limitación de la Fase 1 (dicha con claridad)

Sin servidor, el celular solo puede mostrar notificaciones cuando la app **está abierta o se acaba de usar**. Los avisos con la app cerrada (y el resumen diario a una hora fija) llegan en la **Fase 2** con notificaciones push. El modelo de avisos (RN-AL-03/04) es el mismo; solo se agrega un canal.

## Modelo

- `EstadoDeStock` (objeto de valor): `AGOTADO` | `POR_ACABARSE` | `NORMAL`, con orden de gravedad `AGOTADO > POR_ACABARSE > NORMAL`.
- `RegistroDeAviso` (por producto): último estado avisado. Se usa para aplicar RN-AL-03 y RN-AL-04.
- Puerto `Notificador`: `notificar(aviso)`. Adaptadores: notificación del sistema (Service Worker) y aviso dentro de la app. En la Fase 2 se agrega el adaptador push.

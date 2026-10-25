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
| HU-AL-05 | Como usuario principal quiero que la app me **recuerde cuándo toca pagar el local**. |

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
| **RN-AL-02** | El estado se **re-evalúa** después de cada operación, al cambiar el stock mínimo o la configuración, y al abrir la app (la predicción cambia con los días aunque no haya ventas). *Operaciones seguidas* (menos de 0.3 s entre una y otra, hasta 1.2 s en total) se re-evalúan juntas al final, comparando el estado final con el último avisado: un cambio que se revierte dentro de ese lapso no avisa, y el contador de *Control* se actualiza hasta ~1 s después (RN-SIS-09). |
| **RN-AL-03** | Se genera un **aviso** solo cuando el estado **empeora**: `NORMAL → POR_ACABARSE`, `NORMAL → AGOTADO` o `POR_ACABARSE → AGOTADO`. Mientras el estado no mejore, no se repite el aviso del mismo producto. |
| **RN-AL-04** | Cuando el estado de un producto **vuelve a `NORMAL`** (por ejemplo, llegó mercadería), el aviso se **rearma**: si vuelve a empeorar, se avisa de nuevo. |
| **RN-AL-05** | El color **nunca es la única señal**: cada estado se muestra con color, ícono y texto. |
| **RN-AL-06** | **Canales en Fase 1**: (a) avisos en Inicio, **uno por tarjeta** en un carrusel de filas compactas (ícono, texto y flecha): "N productos agotados" (flecha *Ver agotados*, abre *Productos* filtrado por *Agotados*), "Queda poco de N productos" (*Ver lo que queda poco*, filtrado por *Queda poco*) y "N precios para revisar" (*Ver precios para revisar*, abre *Ayuda inteligente*), cada uno solo si hay algo; sin ninguno, "Todo en orden" (RN-CAT-16); (b) número en el botón *Control* de la navegación; (c) **notificación del sistema** del celular, si el usuario dio permiso. |
| **RN-AL-07** | Si varios avisos nacen a la vez (por ejemplo, al abrir la app), se agrupan en **una sola notificación**: "3 productos se están acabando". Tocarla abre *Productos* filtrado por *Se acaban* (RN-CAT-16); la notificación de un solo producto abre su detalle. |
| **RN-AL-08** | El **permiso de notificaciones** nunca se pide al abrir la app por primera vez. Se pide desde una pantalla que explica para qué sirve, con botón "Sí, avísame". Si se rechaza, la app funciona igual con avisos internos, y Ajustes explica cómo activarlas. |
| ~~RN-AL-09~~ | **Retirada** (2026-10-19): el dueño quiere Inicio solo para vender; la ganancia de ayer ya se ve en *Control*. |

### Recordatorio de pago del local

| Id | Regla |
|---|---|
| **RN-AL-10** | **Recordatorio en *Control***: si el local tiene pago configurado (RN-AN-17) y la siguiente fecha de pago **igual o posterior a hoy** (RN-AN-18) cae **hoy, mañana o pasado mañana**, la tarjeta *Alquiler del local* (RN-AN-19) muestra **una línea** con el texto de la tabla de abajo. No hay botón para cerrarla: desaparece sola al pasar la fecha. Sin configurar o con *No pago*, no hay recordatorio. Ya no se muestra en Inicio. |
| **RN-AL-11** | **Notificación del pago**: con permiso de notificaciones (RN-AL-08), se envía **una sola notificación por cada fecha de pago**, la primera vez que se abre la app dentro de esa ventana de 3 días. Tocarla abre **Control**. Se guarda la última fecha de pago avisada para no repetirla; si cambia la configuración del local, una fecha nueva sí se avisa. Tiene la misma limitación de la Fase 1 que los avisos de stock (ver abajo). |

## Textos de los avisos

| Situación | Texto |
|---|---|
| Un producto pasa a *Por acabarse* | `Queda poco: <nombre> (<stock>)` y, si hay predicción, `Queda poco: <nombre> (<stock>, se acaba en ~N días)` |
| Un producto pasa a *Agotado* | `Se acabó: <nombre>` |
| Varios avisos a la vez | `N productos se están acabando` |
| Pago del local en 2 días | `Pasado mañana pagas el local: S/ <monto>` |
| Pago del local en 1 día | `Mañana pagas el local: S/ <monto>` |
| Pago del local hoy | `Hoy pagas el local: S/ <monto>` |

El recordatorio del local va siempre en su propia notificación; no se agrupa con los avisos de stock (RN-AL-07).

Las cantidades usan singular o plural según corresponda: "Solo queda 1 kg", "Solo quedan 2 unid.".

## Limitación de la Fase 1 (dicha con claridad)

Sin servidor, el celular solo puede mostrar notificaciones cuando la app **está abierta o se acaba de usar**. Los avisos con la app cerrada (y el resumen diario a una hora fija) llegan en la **Fase 2** con notificaciones push. El modelo de avisos (RN-AL-03/04) es el mismo; solo se agrega un canal.

## Modelo

- `EstadoDeStock` (objeto de valor): `AGOTADO` | `POR_ACABARSE` | `NORMAL`, con orden de gravedad `AGOTADO > POR_ACABARSE > NORMAL`.
- `RegistroDeAviso` (por producto): último estado avisado. Se usa para aplicar RN-AL-03 y RN-AL-04.
- `ultimoPagoDelLocalAvisado` (estado del sistema): fecha de pago (AAAA-MM-DD) de la última notificación del local (RN-AL-11).
- Puerto `Notificador`: `notificar(aviso)`. Adaptadores: notificación del sistema (Service Worker) y aviso dentro de la app. En la Fase 2 se agrega el adaptador push.

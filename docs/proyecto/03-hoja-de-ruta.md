# 03 · Hoja de ruta

> De dónde venimos, dónde estamos y qué sigue. Las novedades de cada versión, en palabras de la tienda, están en el [CHANGELOG](../../CHANGELOG.md).

## Dónde estamos

**Versión publicada: v0.6.0** (2026-10-25) en https://mauriciochu.github.io/predictive-inventory/

La Fase 1 está completa y **en uso real en la tienda**. La regla es: antes de construir la nube, el dueño usa la app un par de semanas con una copia semanal, y lo que salga de ese uso decide los siguientes pasos.

## Lo recorrido (Fase 1)

| Versión | Fecha | Qué trajo |
|---|---|---|
| **0.1.0** | 2026-10-17 | Primera versión: productos con foto y categoría (por unidad, kilo o litro); vender, llegó mercadería, pérdidas, contar stock y conteo guiado; avisos de stock; Control con ganancia, lista para comprar, más vendidos, productos parados y "¿Necesito comprar?"; copias, Excel e importación. |
| **0.2.0** | 2026-10-18 | Alquiler del local: ¿ya cubrí el pago? y recordatorio dos días antes. Restaurar una copia desde la bienvenida. Primera vez guiada paso a paso. |
| **0.3.0 · 0.3.1** | 2026-10-19 | Inicio solo para vender, con los botones al alcance del pulgar. Filtro "Se acaban" en Productos. Aviso de copia en Ajustes. |
| **0.4.0** | 2026-10-20 | Vender con panel a pantalla completa. Vender algunas unidades a otro precio. Se quita el cálculo del vuelto. |
| **0.5.0 · 0.5.1 · 0.5.2** | 2026-10-21 / 22 | Inicio en una sola pantalla. Movimientos en hoja inferior. No se puede vender más de lo que hay. Confirmaciones al centro, con "Deshacer (9)". |
| **0.6.0** | 2026-10-25 | Inicio con Total vendido y Ganancia real y carrusel de avisos. Control para medir (gráficos) y nueva **Ayuda inteligente**. Productos con filtros en hoja. El lápiz del precio cambia el precio para siempre. Animaciones en toda la app. |

## Qué sigue

```
  AHORA                     LUEGO                       DESPUÉS                  MÁS ADELANTE
┌──────────────┐   ┌───────────────────────┐   ┌──────────────────────┐   ┌───────────────────┐
│ Uso real     │──►│ v0.6.x                │──►│ Fase 2 · Entrega A   │──►│ Fase 2 · Entrega B│──► Fase 3
│ de la v0.6.0 │   │ arreglos del uso real │   │ Copia en la nube     │   │ Avisos con la app │
│ + spec Fase 2│   │ + prueba de push      │   │ Recuperar mi tienda  │   │ cerrada · Respaldo│
└──────────────┘   └───────────────────────┘   └──────────────────────┘   └───────────────────┘
```

### 1 · Uso real (ahora)

- El dueño usa la v0.6.0 en la tienda, con una copia semanal.
- El administrador anota lo que le cuesta, lo que no usa y lo que pide.
- En paralelo se escribe la **spec de la Fase 2** como borrador (sin código).

### 2 · v0.6.x

- Arreglos y ajustes que salgan del uso real.
- **Prueba de push** en el celular de la tienda: enviar un aviso con la app cerrada y comprobar que llega. Algunas marcas de Android lo retrasan para ahorrar batería; si pasa, cambia el alcance de los avisos antes de construirlos.
- Si del uso real sale algo más urgente que la nube (fiado, cierre del día), se decide aquí si va antes.

### 3 · Fase 2 · Entrega A: copia en la nube

- API FastAPI con Postgres en Neon, publicada gratis.
- Las operaciones se suben una por una en segundo plano (sin repetirse aunque se envíen dos veces). Productos, ajustes y fotos se suben como una copia completa, con el formato del respaldo que ya existe.
- En Ajustes: "Copia en la nube: al día · hace 5 min".
- **Recuperar mi tienda** en un celular nuevo, con un código de recuperación.
- Con la copia en la nube llega la **v1.0.0** ([ADR-0010](../adr/0010-versiones-y-publicacion.md)).

### 4 · Fase 2 · Entrega B: avisos con la app cerrada y respaldos

- Avisos push al celular de la tienda y al de un familiar (invitado con un enlace o QR).
- Resumen del día, *por acabarse* o *agotado*, pago del local y "el celular de la tienda no se conecta hace 3 días".
- Copia nocturna de la base, cifrada, con prueba de restauración automática cada mes.

Las decisiones detrás de esto están en [02-alcance · Fase 2](02-alcance.md#fase-2--nube-decisiones-preliminares).

### 5 · Fase 3: consulta a distancia

Inicio de sesión del administrador y modo consulta desde cualquier navegador. Después, registrar desde varios dispositivos.

## Ideas abiertas

Se evalúan con el uso real; ninguna está comprometida.

| Idea | Para qué serviría |
|---|---|
| **Fiado** | Anotar ventas a cuenta y quién debe cuánto. |
| **Cierre del día** | Un resumen al cerrar la tienda: lo vendido, lo ganado y lo que conviene comprar mañana. |
| **Proveedores** | Saber a quién se le compra cada producto y a qué precio. |

## Pendientes conocidos

- "Volver" desde un producto abierto por una notificación lleva a Inicio en vez de a la pantalla anterior.

# 05 · Respaldo, Excel e importación

En la Fase 1 los datos viven solo en el celular. Este módulo asegura que **no se pierdan** y que se puedan revisar o cargar desde Excel.

Criterios de aceptación ejecutables: [features/respaldo.feature](features/respaldo.feature)

## Historias de usuario

| Id | Historia |
|---|---|
| HU-RE-01 | Como administrador quiero **descargar el inventario en Excel** para revisarlo en la computadora o mandarlo por WhatsApp. |
| HU-RE-02 | Como administrador quiero **guardar un respaldo completo** y **restaurarlo** en otro celular si este se pierde o se malogra. |
| HU-RE-03 | Como administrador quiero **cargar muchos productos desde un Excel** en vez de escribirlos uno por uno en el celular. |
| HU-RE-04 | Como usuario principal quiero que la app **me recuerde hacer un respaldo**. |

## Reglas de negocio

| Id | Regla |
|---|---|
| **RN-RE-01** | **Exportar a Excel** genera `inventario-<tienda>-AAAA-MM-DD.xlsx` con tres hojas: **Productos** (nombre, categoría, unidad, precio de compra, precio de venta, stock, stock mínimo, estado de stock, activo/archivado), **Movimientos** (fecha, tipo, producto, cantidad, precio, costo, importe, anulada sí/no, nota) y **Resumen diario** (fecha, ventas, ganancia bruta, mermas, ganancia neta) de los últimos 90 días. El archivo se puede **compartir** (WhatsApp, Drive, correo) o descargar. |
| **RN-RE-02** | **Respaldo completo** genera `respaldo-<tienda>-AAAA-MM-DD-HHmm.json` con **todos** los datos: configuración, categorías, productos (con fotos), operaciones y registro de avisos, más `versionDeFormato`, fecha de creación y un **resumen de control** (cantidad de productos, de operaciones y stock total por producto). Las proyecciones (existencias, resúmenes diarios) **no** se guardan: se reconstruyen. |
| **RN-RE-03** | **Restaurar** reemplaza todos los datos del celular por los del respaldo. Antes de borrar nada: valida el formato, la versión y el resumen de control; muestra qué contiene ("152 productos, 3 840 movimientos, del 01/10/2026 al 15/12/2026") y pide **dos confirmaciones**. Si algo falla, los datos actuales **quedan intactos**. Un respaldo de una tienda que todavía no tiene nombre (el valor inicial, vacío) es válido: el rango de 1 a 40 caracteres es para lo que escribe el usuario. |
| **RN-RE-04** | Después de restaurar, las existencias y los resúmenes se **reconstruyen desde las operaciones** y se comparan con el resumen de control; si no coinciden, la restauración se revierte y se informa el error. |
| **RN-RE-05** | Un respaldo de una versión de formato **más nueva** que la de la app se rechaza con el mensaje "Actualiza la app para abrir este respaldo". Uno de una versión **anterior** se migra automáticamente. |
| **RN-RE-06** | **Recordatorio**: si nunca se hizo un respaldo, o el último tiene **7 días o más**, *Ajustes* muestra, en el enlace *Guardar copia*, "Hace N días que no guardas una copia" (o "Todavía no guardas una copia de tus datos"). Ya no se muestra en Inicio. Desde la Fase 2, con copia automática en la nube, este recordatorio se apaga. |
| **RN-RE-07** | **Importar productos desde Excel**: la app ofrece una **plantilla** descargable con las columnas: nombre, categoría, unidad (unid / kg / L), precio de compra, precio de venta, stock mínimo, stock inicial. Al subir el archivo se muestra una **vista previa** con filas válidas y filas con problema, explicadas en lenguaje simple: "Fila 7: falta el precio de venta". Se importan **solo las filas válidas** después de confirmar. |
| **RN-RE-08** | En la importación, cada fila se valida con las mismas reglas que el formulario (RN-CAT-01 a RN-CAT-08, salvo la RN-CAT-07 retirada). Un nombre repetido, contra el catálogo **o dentro del mismo archivo**, invalida la fila ("ya existe"). Una categoría que no existe **se crea**. El stock inicial mayor que 0 genera una operación `STOCK_INICIAL` por producto. |
| **RN-RE-09** | La app solicita al navegador **almacenamiento persistente** en el primer uso, para que Android no borre los datos al liberar espacio. Si no se concede, el recordatorio de RN-RE-06 aparece a los **3 días** en lugar de 7. |
| **RN-RE-10** | **Restaurar desde la bienvenida**: el primer paso de la primera vez ofrece *Ya tengo una copia guardada*, que abre *Restaurar copia* con las mismas reglas (RN-RE-03 a RN-RE-05). Si la restauración termina bien, la primera vez queda **completada** y se abre Inicio con los datos restaurados. Si se cancela, se vuelve a la bienvenida; si falla, se muestra el error (los datos quedan intactos) y *Volver* lleva a la bienvenida. |
| **RN-RE-11** | **Formato versión 2**: la configuración incluye el costo del local (`alquilerDelLocal`, RN-AN-17). Una copia de la versión 1 se migra con el local **sin configurar** (`null`). |

## Formato del respaldo (versión 2)

```json
{
  "versionDeFormato": 2,
  "creadoEn": "2026-10-15T20:30:00-05:00",
  "app": "predictive-inventory",
  "control": { "productos": 152, "operaciones": 3840, "stockPorProducto": { "<id>": 12000 } },
  "datos": {
    "configuracion": {
      "alquilerDelLocal": { "tipo": "QUINCENAL", "montoCentimos": 60000, "dias": [5, 20] }
    },
    "categorias": [],
    "productos": [],
    "operaciones": [],
    "registroDeAvisos": []
  }
}
```

Cantidades en milésimas y dinero en céntimos, como en la base ([ADR-0003](../../adr/0003-enteros-para-dinero-y-cantidades.md)). Fotos en base64.

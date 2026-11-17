# Arjun: propuesta de inventario y conteo físico

Propuesta para revisión de Pablo y Anil · 17 de noviembre de 2026.
Estado: propuesta aceptada por Pablo con ajustes de buscador y bodega de trabajo incorporados. Implementación no iniciada. No se ha modificado la aplicación ni su base de datos.

## 1. Objetivo

Convertir la app en una herramienta sencilla para encontrar un producto, identificar dónde está, registrar cuántas unidades hay físicamente y calcular la inversión correspondiente. Apagar de forma reversible la operación de módulos. Pablo indicó que los datos se eliminarán al entregar la app; no habrá migración del stock actual. Hasta ese corte se mantienen intactos.

Una sola pantalla principal reúne búsqueda, inventario y consulta de inversión. Al seleccionar un producto se abre su ficha; allí se hace todo el trabajo sobre ese producto. Esto recoge tanto la idea de concentración como la petición expresa de una página por producto.

El buscador permanece disponible también en cada ficha y en las utilidades. Sus coincidencias permiten abrir directamente otro producto sin volver al inventario. El selector «Estoy contando en: Bodega 1 / Bodega 2» mantiene la bodega de trabajo elegida manualmente durante la sesión del bodeguero.

## 2. Qué revisé y qué está comprobado

Repositorio real: `C:\Users\pablo\Documents\app-arjun-v2\app-arjun-v2`.
Referencia: commit `7127b82`; árbol de trabajo limpio durante la revisión. La carpeta superior contiene documentos iniciales desactualizados. Se revisaron documentos vigentes, historial reciente y código de navegación, productos, stock, entradas, identificación, sincronización y valorización.

| Área | Funcionamiento encontrado | Evidencia en el repositorio |
|---|---|---|
| Inicio y navegación | Dashboard con bodegas, módulos y accesos a entradas/salidas; menú lateral amplio | `app/(dashboard)/page.tsx`, `components/DashboardShell.tsx` |
| Productos | Listado con búsqueda; ficha con compras, stock por bodega/módulo, imagen y edición | `app/(dashboard)/productos/`, `lib/actions/productos.ts` |
| Campos editables | Código personal, packing, ubicación libre y observaciones; cambio de foto separado. El código de origen y descripción no son campos editables del formulario actual | `productos/[id]/form.tsx`, `lib/validations/producto.ts` |
| Stock | Cantidad por producto y bodega o módulo; no existe entidad específica de conteo físico por posición con fecha y autor | `db/schema.ts` |
| Entradas | Suman unidades al saldo; exigen cantidad positiva. No equivalen a registrar el stock absoluto contado ni admiten un conteo cero | `lib/actions/entradas.ts` |
| Compras | Sincronización desde Vida Digital y Sanjh, productos con descripción, packing e imagen; movimientos y stock propio. Protege fotos propias existentes | `db/vidadigital/queries.ts`, `lib/sync/compras-anil.ts` |
| Actualización manual | Ya existe un botón «Sincronizar» en Productos y un POST autenticado | `productos/page.tsx`, `app/api/sync/compras-anil/route.ts` |
| Actualización automática | Documentada como objetivo; no encontré configuración de cron en el repo ni un endpoint actual con autenticación de tarea programada. La ruta actual exporta POST con sesión | PRD y ruta anterior. No está verificada la configuración de servicios externos |
| Inversión | Exclusiva de admin. Suma stock de todas las ubicaciones, incluidos módulos, y lo valoriza con compras históricas desde septiembre de 2023; asigna el saldo a los lotes más recientes, coherente con la presunción FIFO de salida | `lib/utils/inversion-lotes.ts`, `inversion-fifo.ts`, `inversion-resumen.ts` |
| Imágenes e identificación | Identificación por foto activa mediante flag; su selección lleva actualmente a Entradas | `config/feature-flags.json`, `components/identificacion/IdentificarProducto.tsx` |
| Usuarios | Roles admin y operador; Usuarios e Inversión visibles solo para admin | `app/(dashboard)/layout.tsx`, `lib/auth.ts` |

Límite de esta revisión: evidencia local del código y documentos; no se ejecutó sincronización, no se consultaron cifras actuales de producción y no se comprobaron servicios externos. Los datos del mockup son ficticios y las fotos proceden de las miniaturas locales del catálogo.

## 3. Requerimientos ordenados

| ID | Pedido | Propuesta |
|---|---|---|
| R1 | Apagar Entradas, Salidas, Retornos, Transferencias, Módulos y Movimientos | Quitar accesos y bloquear sus operaciones/rutas antiguas cuando corresponda. Conservar tablas e historial. Mantener la importación interna de compras y la auditoría |
| R2 | Concentrar todas las opciones | Un centro de inventario con búsqueda y listado; ficha de producto para operar. Usuarios, sesión y foto accesibles desde la misma cabecera |
| R3 | Ocultar columnas Detalle | Ningún listado muestra esa columna; la descripción sigue disponible para búsqueda y en la ficha |
| R4 | Móvil vertical | Filas convertidas en tarjetas con etiquetas, imagen y código arriba, ubicación y stock debajo. También compras y desglose de inversión se adaptan verticalmente |
| R5 | Quitar tres indicadores de inversión | Quitar «Unidades en stock», «Códigos con stock» y «Unidades sin costo». Mantener el importe de inversión; advertir costos faltantes sin convertirlos silenciosamente en cero |
| R6 | Botón ACTUALIZAR | Reubicar y renombrar la acción existente. Mostrar progreso, éxito, error y última actualización exitosa. No exige usarlo para que funcione la actualización automática |
| R7 | Compras automáticas con foto e información | Sincronización programada independiente de sesiones abiertas; mismo servicio que ACTUALIZAR, sin duplicación al coincidir ambos. Mantener Vida Digital + Sanjh salvo decisión expresa |
| R8 | Más espacio en filas | Proponer filas más altas para miniaturas de 56 px y mayor separación entre columnas. Confirmar visualmente si esto corresponde a «espacio horizontal» |
| R9 | Imagen como primera columna | Miniatura ampliable o acceso a ficha; sustituto claro si falta imagen |
| R10 | Intercambiar Valor y Costo prom. | En vista con valores: Imagen, Código, Ubicación, Stock, Costo prom., Valor |
| R11 | Cambiar REMANENTE por SALDO | Aplicar «Saldo» al desglose de lotes en la ficha o modal |
| R12 | Cuatro columnas base | Imagen, Código, Ubicación y Stock; fecha/hora debajo del stock. Autor visible en ficha. Valores como opción adicional para admin |
| R13 | Inicio tipo Google | Buscador central grande por código, código personal o descripción; acceso a identificar por foto y a ver todo el inventario |
| R14 | Conteo en página de producto | Cantidad absoluta por ubicación, cero permitido, fecha/hora del servidor y usuario autenticado automáticos; historial conservado |
| R15 | Editar foto y datos actuales | Foto, código personal, packing, observaciones y ubicación desde la ficha. Mantener las restricciones de edición actuales |
| R16 | Ubicaciones fijas | Selectores dependientes con las opciones de la sección siguiente |
| R17 | Conservar funciones no nombradas | Login, cierre de sesión, usuarios, identificación y creación de código alternativo continúan. Reubicar flujos históricos y de creación manual para que no dependan de Entradas |
| R18 | Buscar desde cualquier ficha | Buscador permanente con coincidencias y apertura directa de otro producto; proteger cambios sin guardar |
| R19 | Bodega predeterminada durante el conteo | Bodega de trabajo elegida por el bodeguero, recordada por usuario/dispositivo durante su sesión; aplicada a las fichas siguientes. No cambia la bodega de otros usuarios ni mueve stock |
| R20 | Sin asignación automática desde compras | Las compras no asignan bodega, planta, pasillo ni posición física, ni suman stock contado. Producto nuevo: pendiente de contar y sin ubicación física |
| R21 | Reinicio al entregar | Entrega con solo Bodega 1 y Bodega 2, sin arrastre de stock ni ubicaciones actuales. Preparar respaldo y alcance exacto del corte antes de ejecutarlo |

## 4. Ubicaciones propuestas

| Bodega | Planta | Pasillo | Posición |
|---|---|---|---|
| Bodega 1 | No aplica | A1, A2, A3 o A4 | Fondo (F), Medio (M) o Principal (P) |
| Bodega 2 | Arriba o Abajo | Izquierda o Derecha | Fondo (F), Medio (M) o Principal (P) |

Se obtienen 12 combinaciones en cada bodega, 24 en total. Ejemplos de presentación: «B1 · A2 · Fondo» y «B2 · Arriba · Derecha · Medio». Al cambiar bodega se limpian las selecciones incompatibles.

Confirmado por Pablo: un mismo código puede tener unidades en más de una bodega simultáneamente. Registrar el conteo de cada posición por separado y mostrar todas en la ficha. La lista agrupa por código, resume posiciones y suma únicamente los últimos conteos de cada una. Si las fechas difieren se muestra «varios conteos», sin atribuir una única fecha a la suma.

Confirmado por Pablo: solo existen Bodega 1 y Bodega 2. El inventario actual se reiniciará al entregar, por lo que no se requiere correspondencia ni traslado desde las tres bodegas configuradas actualmente.

La bodega de trabajo no se deduce del producto ni del proveedor. La primera vez se pide elegirla; desde entonces se preselecciona esa bodega al abrir cualquier producto. Planta, pasillo y posición se eligen manualmente; no se supone que un producto nuevo está en A1 o en Fondo. Cambiar la bodega de trabajo modifica el valor predeterminado de la sesión, nunca los conteos ya guardados. Otro usuario puede trabajar al mismo tiempo en la otra bodega.

Ejemplo: el bodeguero elige Bodega 2, abre HR-6 y cuenta 30 unidades en Arriba / Derecha / Medio. Busca HN-1 desde esa ficha: se abre con Bodega 2 preseleccionada. Si HR-6 tenía 80 unidades contadas en Bodega 1, conserva ambos conteos y el total es 110; contar en Bodega 2 no reemplaza Bodega 1.

### Asignación automática encontrada en el código actual

`db/vidadigital/queries.ts` extrae el quinto segmento del número de ingreso y llama a `getBodegaPorCodigoIngreso`: GLP y GL2 se asignan a Bodega 1 Vida Digital; GL1 a Bodega 2 Vida Digital. `lib/sync/compras-anil.ts` traduce esos nombres a IDs y escribe automáticamente stock y movimientos en esa bodega. Esta cadena debe dejar de alimentar ubicaciones y stock físico en el modo nuevo.

No encontré en esa consulta de compras una asignación automática de planta/pasillo/posición: la ubicación del maestro actual es un texto libre; Entradas puede precargar el ya guardado. En el nuevo diseño toda ubicación física proviene de la selección manual y los conteos. El dato de bodega del documento del proveedor puede conservarse como metadata de la compra si es necesario para trazabilidad, sin asignar inventario físico ni descartar compras por falta de mapeo.

## 5. Regla central: comprar no equivale a contar

Regla aprobada por Pablo: separar tres datos.

1. **Compras importadas:** documentos y cantidades confirmadas del proveedor; alimentan el catálogo y los costos.
2. **Último conteo físico:** unidades realmente contadas por posición, con autor y fecha. La importación nunca cambia este registro.
3. **Inversión según conteos:** valorización de esas unidades, usando las compras elegibles a la fecha del conteo. Una compra posterior no revaloriza silenciosamente un inventario anterior.

Ejemplo: se cuentan 80 unidades el lunes y llega una compra de 20 el martes. Se incorpora la compra y su producto/foto; la lista sigue diciendo «80 · contado el lunes», con aviso «Compras posteriores al conteo». Un producto nuevo aparece «Pendiente de contar», nunca como cero contado. Al volver a contar 95, el nuevo conteo reemplaza la referencia vigente de esa posición y conserva el anterior; no suma 95 a 80.

Sin salidas registradas, no se puede asegurar el stock real entre dos conteos. El importe debe rotularse «Inversión según últimos conteos» y advertir si reúne fechas distintas. Si Anil necesita una fotografía de inversión a una fecha común, conviene un cierre de jornada/campaña de inventario; se define su alcance antes de implementarlo.

Para cuadratura, la ficha muestra conteo anterior, nuevo conteo y diferencia. La conciliación de compras app/proveedor sigue siendo una comprobación distinta: no demuestra que el stock físico cuadre.

No se suma automáticamente una compra posterior al stock contado. El catálogo y las compras se actualizan de forma independiente.

## 6. Pantallas y comportamiento

**Inicio:** marca Arjun, búsqueda grande, «Identificar por foto», «Ver inventario», ACTUALIZAR y estado de compras. Cabecera con Usuarios para admin y cierre de sesión.

**Inventario:** misma búsqueda y una sola lista. Cuatro columnas base. Un interruptor «Mostrar valores» añade Costo prom. y Valor y el total de inversión, solo para admin. Incluye productos sin contar y con cero unidades, para poder encontrarlos y contarlos.

**Ficha:** buscador permanente que abre otra ficha directamente, selector de bodega de trabajo, imagen y cambio de foto; código y descripción; bloque principal de conteo con ubicación, cantidad y comparación; guardar conteo con fecha/autor automáticos. Debajo, editar campos existentes y desplegables para historial de conteos, compras y valorización («Saldo»). Volver restaura búsqueda y posición en listado. Buscar otro producto no descarta silenciosamente un conteo sin guardar.

**Identificador:** conserva captura y sugerencias, pero al elegir abre la ficha de inventario. Producto solo presente en el catálogo externo: incorporación segura al catálogo local antes del conteo. Si no hay coincidencia, se conserva creación manual/código ARJ y buscador histórico.

**Usuarios y otras utilidades:** panel o pantalla secundaria accesible desde cabecera. Concentrar la operación diaria no significa mostrar formularios administrativos permanentemente.

**Móvil:** ninguna acción depende de desplazarse horizontalmente. Cantidad con teclado numérico; Guardar visible al completar el formulario. Historial y compras se despliegan bajo demanda.

## 7. Apagado reversible y protección del inventario

- Un flag de modo inventario gobierna navegación, rutas y operaciones antiguas. Ocultar menús por sí solo no impide registrar una salida por una URL guardada.
- Mantener identificación aunque hoy cuelgue de `/entradas/identificar`; reubicarla o permitirla explícitamente antes de bloquear Entradas.
- Excluir saldos de módulos de la inversión de bodega; hoy el cálculo suma ambos. Conservarlos como histórico sin trasladarlos a bodega por decisión técnica.
- Conservar auditoría interna aunque desaparezca el menú Movimientos.
- Mantener búsquedas históricas y productos manuales de otros proveedores desde los nuevos accesos.
- Mantener permisos actuales de costos/inversión y usuarios. No ampliar a operadores sin decisión expresa.
- Pablo solicita eliminar los datos al entregar. Preparar un corte nuevo acorde al modo de inventario, con respaldo y listado exacto de tablas/archivos afectados. «Todos los datos» no se interpreta todavía como borrar cuentas, catálogo, fotos o registros externos: ese alcance se concreta antes del corte. No ejecutar ahora el plan antiguo de CONTEXT ni borrar información de Vida Digital/Sanjh.

## 8. Riesgos e integración a cubrir en pBravoT

| Riesgo | Verificación exigida |
|---|---|
| Doble conteo o doble clic | Guardar dos veces la misma solicitud no duplica registros; recontar sustituye referencia, conserva historial |
| Dos usuarios contando la misma posición | Conflicto visible; no sobrescribir silenciosamente el conteo de otro usuario |
| ACTUALIZAR y tarea automática simultáneos | Misma compra una sola vez y avance seguro del watermark; revisar bloqueo y transacción compartidos |
| Compra sin metadata en catálogo | Hoy la consulta usa un JOIN interno a productos; asegurar que una compra confirmada no quede omitida por faltar metadata |
| Imágenes propias | La sincronización no reemplaza una foto local válida ni la ubicación física asignada |
| Migración de ubicación libre | Conservar original; revisión/asignación explícita a catálogo fijo sin interpretar texto como ubicación válida |
| Fechas de valorización | No usar compras posteriores para valorar conteos anteriores; tratamiento explícito de stock sin costo |
| Permisos y rutas ocultas | Operador sin acceso a costos/usuarios; módulos apagados también por acceso directo; identificación utilizable |
| Base de datos | PRD advierte desfase de constraint de usuarios: no ejecutar push de schema que proponga truncar users; migración puntual revisada |
| Regresiones conocidas | Revisar BUGS, QA-REGISTRO y pruebas de imagen/packing, idempotencia, confirmación de notas y ajustes |

Impacto lateral previsto: inicio y shell, páginas/API de productos, ficha e imágenes, identificación y creación manual, stock y nuevo historial de conteos, ubicaciones, importación programada/manual, valorización, flags, permisos, QA y documentación. La lista exacta se fija en cada contrato; no es un cambio puramente visual.

## 9. Criterios de aceptación propuestos

- CA1: al iniciar sesión se ve el buscador; buscar por descripción encuentra productos aunque no exista columna Detalle.
- CA2: entrar a un resultado permite contar sin pasar por Entradas; guardar 0 es válido y distinto de no haber contado.
- CA3: guardar dos veces o reintentar por mala conexión no duplica; fecha, hora y autor proceden del servidor/sesión.
- CA4: cambiar de Bodega 1 a 2 muestra planta, limpia A1–A4 y ofrece solo Izquierda/Derecha.
- CA5: en móvil vertical la fila/tarjeta y formularios se leen completos, incluidos valores habilitados, sin arrastre lateral.
- CA6: compras nuevas aparecen sin abrir la app; ACTUALIZAR ejecuta la misma importación y permite reintentar errores.
- CA7: una compra posterior no altera cantidad ni fecha de un conteo anterior; nuevo producto queda pendiente de contar.
- CA8: foto manual y otros campos editables sobreviven a la siguiente sincronización.
- CA9: sin permiso admin no se ven ni consultan costos; identificación, usuarios autorizados y cierre de sesión siguen operativos.
- CA10: los flujos apagados no pueden usarse con enlaces antiguos; su historial se conserva.
- CA11: inversión usa solo alcance de bodega acordado, muestra fechas y advierte ausencia de costos; «Saldo» sustituye «Remanente».
- CA12: volver de una ficha conserva filtro y búsqueda; crear un producto manual o histórico sigue siendo posible desde los nuevos accesos.
- CA13: desde HR-6 se busca HN-1 y se abre su ficha directamente; el buscador también se mantiene en móvil y advierte conteos sin guardar.
- CA14: seleccionar Bodega 2 mantiene ese valor en los siguientes productos, aunque tengan conteos en Bodega 1; usuarios distintos mantienen contextos independientes.
- CA15: importar una compra con GLP/GL1/GL2 no crea ni modifica stock contado o ubicación física. Producto nuevo queda sin ubicación y pendiente de contar.
- CA16: contar 30 en Bodega 2 para un código con 80 en Bodega 1 conserva ambos registros y muestra 110 como total, con sus fechas por posición.

## 10. Decisiones para cerrar el diseño

| Decisión | Recomendación inicial |
|---|---|
| Qué significa Stock | APROBADO: último conteo físico; compras posteriores separadas |
| Un código en varias posiciones | APROBADO: permitir stock en ambas bodegas y contar por posición |
| Bodegas nuevas | CONFIRMADO: solo Bodega 1 y Bodega 2; datos actuales se reinician al entregar |
| Bodega de trabajo | APROBADO: elegida manualmente, predeterminada para los siguientes productos de esa sesión |
| Buscador en ficha | APROBADO: disponible sin regresar al inventario |
| Valores en tabla de cuatro columnas | Ocultos por defecto; activables por admin; Costo prom. antes de Valor |
| Proveedores | Mantener Vida Digital + Sanjh como está implementado |
| Frecuencia de importación | Proponer 15 minutos, pendiente de comprobar capacidad y servicio programador; no es tiempo real instantáneo |
| Inversión periódica | Últimos conteos con fechas visibles; definir cierre común si se necesita fotografía a una fecha |

## 11. Implementación posterior al acuerdo

Primero actualizar PRD con decisiones y criterios aprobados. Luego contratos y plan QA por slices de máximo 200 líneas: apagado reversible e integración del identificador; catálogo de ubicaciones; conteos auditados y concurrencia; ficha; búsqueda/inventario; importación automática segura; valorización por conteos; adaptación móvil y regresión completa. Cada bloque podrá necesitar varios slices.

El Programador Claude Code escribe el código. Codex dirige, revisa diffs y verifica por su cuenta. Los ajustes solicitados en esta revisión están incorporados a la propuesta y maqueta; no se ha iniciado la modificación de la app. Antes de producción: requisitos pBravoT, QA, UAT de Pablo y humo posterior. El reinicio pedido se realizará al entregar, una vez concretados respaldo y alcance, no durante esta revisión.

## 12. Comprobación de la propuesta

La maqueta se revisó visualmente en escritorio y móvil. Se verificaron búsqueda, apertura de ficha, guardado simulado de conteo, aceptación de cero, selectores dependientes de bodega, carga de miniaturas y ausencia de desborde horizontal a 320 px. En la revisión se comprobó además cambiar de HR-6 a HN-1 directamente con el buscador de ficha, mantener Bodega 2 como predeterminada y advertir un conteo sin guardar. No se ejecutó la suite de la app: no hubo cambios de aplicación. El repositorio se mantuvo limpio al terminar la revisión.

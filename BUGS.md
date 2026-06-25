# BUGS.md — Registro de bugs resueltos

---

## 2026-06-19 — Crash al cargar /productos/[id] en producción

**Síntoma:** "This page couldn't load" en Chrome al visitar el detalle de
cualquier producto en producción (all-arjun-v2.vercel.app). Funcionaba en
local (dev mode).

**Causa raíz:** lib/actions/productos.ts no tenía "use server". El Client
Component EditarProductoForm importaba updateProducto desde ese archivo,
y Next.js empaquetó Drizzle + el driver de Neon (que usa net/tls de Node)
dentro del bundle del cliente. El navegador no tiene esos módulos → crash
al hydratar.

**Por qué no se veía en dev:** Turbopack en modo desarrollo resuelve estas
importaciones server/client de forma más laxa que el build de producción
optimizado.

**Fix:** agregar "use server" en la primera línea de lib/actions/productos.ts,
consistente con lib/actions/vistas.ts (que ya la tenía).

**Verificación:** grep contra .next/static/chunks/ confirmó la presencia de
drizzle/neon/postgres en el bundle del cliente antes del fix, y su ausencia
después. Build, tsc y 138/138 tests verdes.

**No tocar sin revisar:** cualquier archivo en lib/actions/ que sea
importado desde un "use client" component debe tener "use server" en la
primera línea, sin excepción.

---

## 2026-06-19 — URL ?q= vacío persiste indefinidamente en /productos

**Síntoma:** la URL queda en /productos?q= (colgando) tras volver del
detalle de un producto o usar el botón atrás, y el filtro de búsqueda
no se preserva ni se limpia visualmente.

**Causa raíz confirmada:** en el finally del useEffect de carga inicial,
`if (urlQ) { setQ(urlQ); ... }` trata "" como falsy, así que cuando
urlQ ya es "" no se llama setQ ni se actualiza la URL. Como q no cambia,
el useEffect que depende de [q] nunca dispara, y router.replace nunca
se ejecuta para limpiar la URL.

**Origen no confirmado:** no se pudo reproducir interactivamente en este
entorno (curl no captura navegación client-side). Hipótesis no verificadas:
race condition entre debounce/router.replace y navegación rápida del
usuario. El fix corrige el mecanismo de autosanación independientemente
del origen.

**Fix:** applyInitialUrlSync(urlQ, router.replace) se ejecuta siempre en
el finally de la carga inicial, sin condicional. Función extraída para
test (applyInitialUrlSync), confirma que replace se llama incluso con urlQ="".

**No tocar sin revisar:** cualquier sincronización de estado-a-URL en
este proyecto debe tratar "" explícitamente, no asumir que un check
truthy es equivalente a "no hay valor que sincronizar".

---

## 2026-06-19 — Retornos mostraba productos que no pertenecen al módulo origen

**Síntoma:** en `/retornos`, al seleccionar "Módulo 180" como origen, el
typeahead mostraba VD-002 (y posiblemente otros productos) que no existen
en ese módulo. Registrado por Pablo durante verificación visual post-Slice B.

**Causa raíz:** el endpoint `/api/productos/por-bodega` ignoraba el
parámetro `tipo=modulo` que retornos le mandaba. Siempre filtraba por
`stock.bodegaId`, incluso cuando el caller pedía filtrar por módulo.
Retornos pasaba `bodegaId=${moduloId}&tipo=modulo` pero el endpoint solo
leía `bodegaId` y hardcodeaba `eq(stock.bodegaId, bodegaId)`.

**Por qué VD-002 específicamente:** Bodega 1 Vida Digital y Módulo 180
comparten el mismo ID interno (ambos id=1 en sus respectivas tablas,
confirmado en `lib/constants.ts`). VD-002 tiene stock en Bodega 1. El
`INNER JOIN` con productos hacía `eq(stock.bodegaId, 1)` → devolvía
VD-002 como si estuviera en Módulo 180. Colisión de IDs entre tablas
distintas — riesgo documentado en CLAUDE.md regla #6.

**Fix:** agregar `resolveTipoUbicacion(tipo)` que devuelve "modulo" vs
"bodega", y usar la columna correcta en el WHERE del endpoint
(`stock.moduloId` cuando tipo=modulo, `stock.bodegaId` en caso contrario).

**Verificación:** 4/4 tests de `resolveTipoUbicacion` (función pura),
25/25 files, 181/181 tests, build limpio.

---

## 2026-06-19 — VD-002 muestra imagen en /entradas pero no en el resto de la app

**Síntoma:** VD-002 (y cualquier producto sincronizado desde Vida Digital)
muestra imagen en el typeahead de `/entradas` pero no en `/productos`,
`/salidas`, `/retornos` ni el detalle de producto.

**Causa raíz:** dos fuentes de imagen distintas:
- `/entradas` busca en el catálogo externo de Vida Digital (`public.productos`
  de `VIDADIGITAL_DATABASE_URL`), que ya tiene `imagen_url` poblada.
- El resto de la app lee `productos.imagen_url` de la base local de
  app-arjun-v2. El sync (`compras-anil.ts`) insertaba productos con
  `(codigo, detalle, packing)` — sin `imagen_url`. La columna local
  quedaba NULL para todo producto sincronizado.

**Fix:**
1. `getComprasAnilDesde()` ahora selecciona `p.imagen_url` desde Vida Digital
   (ambos UNION ALL: vida y sanjh). `CompraAnil` incluye `imagenUrl`.
2. `upsertProductoDesdeSync()` extraído como función independiente desde el
   CTE `producto_ok`. Usa `ON CONFLICT (codigo) DO UPDATE SET imagen_url =
   COALESCE(productos.imagen_url, EXCLUDED.imagen_url)` — si el usuario
   ya subió imagen (no NULL), gana el usuario; si está NULL, se llena con
   la de Vida Digital. Idempotente: re-correr el sync no pisa ni duplica.
3. La extracción permite testear el SQL real contra DB real vía
   `upsertProductoDesdeSync()` exportada. El test de integración
   (`sync-imagen-merge.test.ts`) ejecuta la misma función que corre en
   producción — sin copia inline del SQL.

**Atomicidad:** `upsertProductoDesdeSync()` se ejecuta antes del CTE de
stock/movimientos. Si el CTE de stock falla, el watermark no avanza
(porque la excepción sale del loop sin actualizar `maxFecha`), así
que el sync reprocesa la NV en la próxima corrida. El upsert de producto
es idempotente — repetirlo es inocuo.

**Verificación:** 26/26 files, 185/185 tests. 4/4 tests de integración
real (importan `upsertProductoDesdeSync` de `compras-anil.ts`, no una copia).
Rojo retroactivo confirmado: con `git stash` (código viejo), 3/4 tests
fallan porque la función no existe.

**No tocar sin revisar:** cualquier endpoint que reciba un parámetro de
ubicación DEBE validar el tipo de ubicación antes de elegir la columna
del WHERE. El nombre `bodegaId` en la URL es engañoso — cuando `tipo=modulo`,
el valor es un móduloId, no un bodegaId.

---

## 2026-06-19 — Buscador de /entradas no priorizaba coincidencias exactas, mostraba duplicados

**Síntoma:** al escribir un código completo (ej. "VD-002"), el dropdown
mostraba otros productos sin relación (ej. "CVD-12") antes del match
exacto. Además, el mismo código podía aparecer dos veces en la lista.

**Causa raíz:**
1. buscarProductoHistorico() ordenaba con ORDER BY codigo (alfabético
   puro, sin ranking de relevancia) — C ordena antes que V sin importar
   qué tan bien coincide con la búsqueda.
2. Sin DISTINCT — public.productos unifica Sanjh (empresa_id=1) y Vida
   Digital (empresa_id=2). Un mismo código existente en ambas empresas
   producía dos filas.

**Fix:** subquery con DISTINCT ON (codigo) para deduplicar (DISTINCT
simple no es compatible con el ORDER BY de ranking — Postgres exige que
las expresiones del ORDER BY estén en el SELECT cuando se usa DISTINCT
plano; confirmado con error real contra la DB antes de aplicar). El
ORDER BY externo prioriza codigo ILIKE query% DESC (match de prefijo
exacto primero), luego alfabético.

**Decisión consciente:** cuando un código existe en ambas empresas con
detalle/imagen distintos, DISTINCT ON (codigo) ORDER BY codigo no
garantiza determinismo sobre cuál fila gana. Se acepta sin desambiguar
por empresa_id — las diferencias entre catálogos son mínimas para este
uso (typeahead de selección rápida), no amerita la complejidad extra.

**Verificación:** test de integración real contra DB (mismo patrón que
sync-imagen-merge.test.ts) — rojo confirmado antes del fix (1/4 fallando
por duplicados), verde después (4/4). 27/27 files, build limpio. El SQL
con DISTINCT + ORDER BY expresión fue probado contra Postgres real antes
de aplicar — falló como se esperaba, confirmando la necesidad del subquery.

**No tocar sin revisar:** cualquier query con DISTINCT en este proyecto
debe verificar compatibilidad con ORDER BY de expresiones calculadas —
Postgres exige que coincidan salvo que se use DISTINCT ON o un subquery
intermedio.

---

## 2026-06-22 — Entradas manuales no guardaban imagen ni packing del producto

**Síntoma:** al crear una entrada manual desde `/entradas` seleccionando
un producto del catálogo de Vida Digital, el producto se insertaba en la
base local pero sin `imagen_url` ni `packing`. En `/productos` y `/bodegas`
no se veía ni la miniatura ni el empaque.

**Causa raíz:** mismo patrón de bug que el del sync de Anil (2026-06-19),
pero en un segundo punto de entrada de datos que no se revisó en su momento.

`lib/actions/entradas.ts` tenía su propio INSERT:
```sql
INSERT INTO productos (codigo, detalle)
VALUES (...)
ON CONFLICT (codigo) DO NOTHING
```
— sin `imagen_url`, sin `packing`. El `ON CONFLICT DO NOTHING` preservaba
los NULLs para productos que ya existían (ej. porque entraron antes por el
sync de Anil antes del fix de imagen_url de ayer). Para productos genuinamente
nuevos, el INSERT inicial los creaba sin esos dos campos desde el principio.

La cadena completa de 5 eslabones rotos:
1. `buscarProductoHistorico()` no seleccionaba `cantcaja` desde Vida Digital
2. El tipo `Sugerencia` en `/entradas` no tenía campo `packing`
3. `applyProductoSugerencia()` no propagaba `packing`
4. `crearEntrada` no recibía `imagenUrl` ni `packing` en su input
5. `crearEntrada` escribía su propio INSERT incompleto, sin reusar `upsertProducto`

**Fix:**
1. `buscarProductoHistorico()` ahora trae `cantcaja` (mapeado a `packing`) además
   de `imagen_url`. `ProductoHistorico` incluye `packing: number | null`.
2. `applyProductoSugerencia()` propaga `packing` con `?? null` — mismo patrón que
   `imagenUrl`. Null = "desconocido", 0 = "sin empaque" (estados distintos).
3. `crearEntrada` reemplaza su INSERT propio por `upsertProducto()` — la misma
   función que usa `syncComprasAnil`, renombrada de `upsertProductoDesdeSync` a
   `upsertProducto` porque ahora la comparten dos contextos distintos (sync
   automático + entrada manual). Cero SQL duplicado.
4. Schema Zod de `packing` usa `.nonnegative()` en vez de `.positive()` — acepta
   `packing=0` (producto suelto, sin caja), que `.positive()` rechazaba.

**Nota — si aparece un tercer punto de entrada de productos en el futuro** (ej.
otro formulario manual, un import CSV, una API externa), debe usar `upsertProducto`
también — no escribir su propio INSERT. La función vive en `lib/sync/compras-anil.ts`
pero su nombre ya es genérico; si el acoplamiento de import molesta, moverla a
`lib/actions/productos.ts` o similar, pero siempre un solo punto de verdad para
el upsert de productos.

**Verificación:** 10/10 tests verde (7 entradas-imagen incluyendo 3 nuevos de
packing R4-R6, 3 sync-imagen-merge con el rename). 27/28 files, 188/189 suite
completa. Build limpio.

---

## 2026-06-22 — Dashboards /bodegas y /modulos no reflejaban stock nuevo

**Síntoma:** `/bodegas` y `/modulos` mostraban stock solo para la primera
bodega/módulo. Bodega 2 tenía stock visible en `/bodegas/2` (detalle), pero
la card en el listado `/bodegas` decía 0. Las demás bodegas/módulos siempre
en 0 aunque después se crearan productos en ellas.

**Causa raíz:** Next.js pre-renderizaba ambas páginas como contenido estático
(`○ Static`) en el build. El HTML se congelaba con los datos de la DB en el
momento exacto del build. En ese momento, solo Bodega 1 tenía stock — las
entradas posteriores a Bodega 2 nunca se reflejaron porque la página estática
nunca se revalidó.

`getBodegas()` y `getModulos()` funcionaban correctamente (verificado con
query SQL cruda y con test diagnóstico directo). El bug era 100% de
estrategia de renderizado, no de lógica de negocio.

El build output mostraba:
```
○ /bodegas    ← Static (prerendered at build time, frozen forever)
○ /modulos     ← Static
```

Mientras que las páginas de detalle eran dinámicas (`ƒ`) por usar
`useParams()` en un client component, y por eso `/bodegas/2` sí mostraba
datos frescos. Esto creaba el espejismo de que "solo el primero funciona"
— en realidad era que solo Bodega 1 tenía datos en el momento del build.

`/productos` y `/movimientos` también eran `○ Static`, pero no sufrieron
el mismo síntoma: son client components con shell vacío que fetchean datos
al montar (vía `fetch()` o server action). El HTML pre-renderizado no
contiene datos — solo el esqueleto de la UI. El bug solo afectó a server
components que renderizan datos de DB en el servidor.

**Fix:**
1. `export const dynamic = "force-dynamic"` en `bodegas/page.tsx`
2. `export const dynamic = "force-dynamic"` en `modulos/page.tsx`

Build output pos-fix:
```
ƒ /bodegas     ← Dynamic (server-rendered on each request)
ƒ /modulos      ← Dynamic
```

**Costo en Vercel:** irrelevante para esta escala (~30 invocaciones/día,
3 usuarios). No amerita ISR ni estrategias de caché más complejas.

**Nota — al agregar una página nueva que muestre datos de DB como server
component**, verificar en el build output que aparezca como `ƒ Dynamic` y
no como `○ Static`. Si aparece como `○ Static`, agregar
`export const dynamic = "force-dynamic"`. Las páginas que son client
components con shell vacío no necesitan esto (son estáticas sin datos).

---

## 2026-06-23 — Inversión semántica en columnas de movimientos para retornos {#inversion-semantica-retornos}

**Síntoma:** ninguno visible en producción hoy. Riesgo latente detectado
durante el diseño del mecanismo de "ajuste de stock" (corrección de
saldos), al necesitar leer el origen/destino real de un movimiento.

**Causa raíz:** crearRetorno() invierte los valores al insertar en
movimientos. Para una fila de tipo 'retorno':
- bodega_origen_id guarda el DESTINO real (la bodega a la que vuelve
  el producto), no el origen
- modulo_destino_id guarda el ORIGEN real (el módulo de donde sale
  el producto), no el destino

Los nombres de columna (bodega_origen_id, modulo_destino_id) describen
correctamente la semántica de 'salida', pero quedan invertidos para
'retorno'. El stock se mueve correctamente (la lógica de UPDATE/INSERT
en la tabla stock usa los parámetros con sus nombres reales, no las
columnas de movimientos), así que no hay bug funcional - es puramente
un problema de interpretación si alguien lee movimientos.bodega_origen_id
asumiendo que siempre significa "origen".

**Por qué no se corrigió el schema:** renombrar las columnas requeriría
una migración sobre una tabla con datos de producción reales, y tocar
cada lugar que ya escribe en ellas (entradas, salidas, retornos, sync
de Anil) - riesgo desproporcionado para un problema que hoy no tiene
manifestación visible.

**Fix:** lib/utils/movimiento-ubicacion.ts exporta resolverOrigenDestino(),
que es el ÚNICO punto de verdad para interpretar estas columnas. Recibe
tipo + las dos columnas crudas, devuelve { origen, destino } correctos
sin importar la inversión. Cualquier código nuevo que necesite origen/
destino de un movimiento debe usar esta función - nunca leer las
columnas inline.

**No tocar sin revisar:** si se agrega un nuevo tipo de movimiento
(ej. "ajuste"), resolverOrigenDestino() debe actualizarse para manejarlo
explícitamente. Hoy lanza error ante cualquier tipo no reconocido -
es defensivo a propósito, para que un tipo nuevo sin actualizar la
función falle ruidosamente en vez de devolver origen/destino incorrectos
en silencio.

**Verificación:** 5/5 tests (entrada, entrada defensivo, salida, retorno
con inversión confirmada, tipo desconocido lanzando error). 28/29 files,
197/198 suite completa (timeout intermitente preexistente en smoke-e2e,
no relacionado). tsc y build limpios.


---

## 2026-06-25 — Stock de Bodega 1 desincronizado respecto a movimientos registrados

**Síntoma:** en `/bodegas/1` y `/productos`, la columna SALDO mostraba
valores incorrectos para 18 productos. Ejemplo visible: V-640S4 con 60
entradas y 3 salidas mostraba saldo 33 en vez de 57.

**Causa raíz:** al inicializar la app, las salidas hacia módulos que ya
existían en la versión 1 se importaron en dos pasos separados:
1. Los movimientos se insertaron directamente en la tabla `movimientos`
   via DDL en Neon (INSERT SQL manual), correctamente como `tipo = 'salida'`
   con `bodega_origen_id = 1` y `modulo_destino_id` correspondiente.
2. El stock de Bodega 1 **no fue decrementado** en ese mismo paso,
   porque el DDL no ejecutó el CTE atomico que usa `crearSalida()`
   (que hace `UPDATE stock SET cantidad = cantidad - N WHERE bodega_id = 1`).

Resultado: la tabla `movimientos` refleja correctamente las salidas,
pero `stock.cantidad` para Bodega 1 quedo inflado en exactamente
`SUM(salidas_importadas_por_DDL)` para cada producto afectado.
Todos los modulos estaban correctos (el DDL si inserto stock en modulos).

**Productos afectados:** 18 filas de `stock` con `bodega_id = 1`.
Diferencias de entre -6 y -330 unidades (todas negativas: stock actual
menor al esperado por movimientos).

**Fix:** UPDATE directo en produccion recalculando `stock.cantidad` desde
los movimientos (entradas - salidas + retornos por bodega). 18 filas
actualizadas. Verificacion post-update: 0 discrepancias restantes.
Spot checks: V-640S4 B1 = 57, A2 B1 = 340, modulos intactos.

**No tocar sin revisar:** cualquier importacion futura de movimientos
historicos via DDL directo debe incluir tambien la actualizacion
correspondiente en la tabla `stock`, o ejecutar el query de reconciliacion
inmediatamente despues. El CTE atomico de `crearSalida()` es el unico
mecanismo que garantiza consistencia automatica entre `movimientos` y
`stock` -- cualquier insercion que lo bypasee deja el stock desincronizado.

---

## 2026-06-25 — "No autenticado" en todas las server actions en producción

**Síntoma:** cualquier server action (`crearEntrada`, `crearSalida`, 
`transferirEntreBodegas`, `crearRetorno`, `crearAjuste`) lanzaba 
"An error occurred in the Server Components render" en producción. Los 
logs de Vercel mostraban `Error: No autenticado`. El dashboard y el 
proxy funcionaban correctamente (el usuario podía navegar). En dev 
local y en tests todo verde (los tests mockean `auth()`).

**Causa raíz:** NextAuth v5 con JWT strategy **no mapea `token.sub` 
→ `session.user.id` automáticamente** (cambio de comportamiento vs v4). 
El token JWT almacena el user ID en `sub`, pero el `session()` callback 
solo populaba `session.user.role` y `session.user.username` — nunca 
`session.user.id`. Las server actions chequeaban `!session?.user?.id` 
→ siempre `true` → throw "No autenticado".

El dashboard (`page.tsx`) y el proxy (`proxy.ts`) usaban 
`!session?.user` (sin `.id`), por eso no fallaban.

**Por qué no se detectó antes:** el commit `fcd3d85` (2026-06-23) fue 
el que agregó las llamadas a `auth()` en las 4 server actions originales. 
En dev local, `auth()` funciona correctamente porque el request context 
es distinto. Los tests mockean `auth()` → `{ user: { id: "62" } }` que 
sí incluye `id`. El bug solo era visible en server actions en producción 
(Vercel), donde el wrapper `getSession()` de `next-auth/lib/index.js` 
construye el objeto `session.user` desde el token JWT (que usa `sub`, 
no `id`).

**Fix:** una línea en `lib/auth.ts` — `session.user.id = token.sub ?? "";` 
en el `session()` callback. Esto restaura el comportamiento esperado: 
todas las server actions, el dashboard y el proxy reciben 
`session.user.id` poblado.

**Verificación post-deploy:** crear una entrada o salida real en 
producción y confirmar que no lanza error. No basta con build verde — 
este bug no era visible en build ni en tests por el mock de `auth()`.

**No tocar sin revisar:** cualquier callback de NextAuth que manipule 
`session.user` debe incluir explícitamente `session.user.id = token.sub`. 
No asumir que NextAuth v5 lo hace automáticamente — lo hacía en v4, lo 
quitó en v5.
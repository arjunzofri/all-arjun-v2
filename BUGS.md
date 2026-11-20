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

---

## 2026-08-05 — 500 al subir imagen en /productos (sharp + Turbopack)

**Síntoma:** en producción, al subir imagen de un producto, la UI muestra
"Failed to execute 'json' on 'Response': Unexpected end of JSON input".
Log de Vercel: `ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open
shared object file` al cargar el módulo nativo sharp con el runtime
linux-x64.

**Causa raíz:** sharp 0.35.x (raíz `^0.35.1`) no se empaqueta correctamente
por Vercel/nft bajo Next.js 16 (Turbopack): el layout nativo/libvips queda
fuera del bundle. Issue lovell/sharp#4567. La app importa sharp
dinámicamente en `lib/cloudinary.ts` (`subirImagen`, `await import("sharp")`)
para comprimir la imagen antes de subir a Cloudinary.

**Por qué no se veía en dev:** Turbopack local resuelve el módulo nativo
del SO local (win32) sin tracing; el fallo es específico del empaquetado
serverless linux-x64 de Vercel.

**Fix:** downgrade `sharp` a `^0.34.4` en package.json (resuelve a 0.34.5).
0.34.x empaca el binario correctamente en Vercel/Turbopack. 0.34.5 además
satisface la preferencia peer de next@16.2.9 (`^0.34.5`), unificando a una
sola versión de sharp en el árbol (antes la raíz `^0.35.1` forzaba 0.35.1
ignorando esa preferencia).

**Verificación post-deploy:** subir una imagen real en producción y
confirmar que devuelve secure_url sin 500. Build + tsc no detectan este
bug — es runtime serverless.

**No tocar sin revisar:** sharp solo se usa en `lib/cloudinary.ts`. Si se
actualiza sharp en el futuro, verificar el empaquetado nativo en Vercel
antes de mergear. Referencia: lovell/sharp#4567.

**Verificado en producción:** 2026-08-05 — el downgrade funcionó, el
`ERR_DLOPEN_FAILED` de libvips desapareció. El error cambió a otro
problema (upload preset), documentado en la entrada siguiente.

---

## 2026-08-05 — 500 al subir imagen — "Upload preset not found" (Cloudinary)

**Síntoma:** tras el fix de sharp, el error ERR_DLOPEN_FAILED desapareció
pero subir imagen sigue fallando con 500. Log de Vercel:
`Cloudinary upload falló: {"error":{"message":"Upload preset not found"}}`.

**Causa raíz:** `subirImagen()` en `lib/cloudinary.ts` hacía un upload
**unsigned** con `formData.append("upload_preset", "arjun-products")`.
Ese preset no existe (o no está en modo unsigned) en el cloud `dbl8yxnjy`.
Los presets son configuración del dashboard de Cloudinary, no verificable
ni creada desde código — dependencia frágil de config externa.

**Fix:** cambiar a **upload firmado** en `subirImagen()`, mismo patrón que
ya usaba `eliminarImagen()`/`generarFirma()` en el mismo archivo. El
FormData lleva `file`, `api_key`, `timestamp` y `signature` (sha1 de
`timestamp=<ts>${secret}`), y ya **no** incluye `upload_preset`. Se
generalizó `generarFirma()` para recibir los params a firmar como string
ya armado + secret, reusándola en ambos llamados (sin duplicar código).

**Referencia:** Cloudinary authentication signatures — el string a firmar
son todos los params salvo `file`, `cloud_name`, `resource_type` y
`api_key`, + `api_secret` al final.
https://cloudinary.com/documentation/authentication_signatures

**Verificación:** tsc + build verdes; tests `__tests__/cloudinary.test.ts`
verdes (los checks de formato/tamaño/credenciales y extraerPublicId no
cambian). La prueba real es subir una imagen en producción tras el deploy.

**No tocar sin revisar:** todo el upload de imágenes pasa por
`lib/cloudinary.ts` con upload firmado. No reintroducir `upload_preset` en
uploads unsigned sin crear/verificar el preset en el dashboard de
Cloudinary. `generarFirma()` es compartida por upload y delete.

---

## 2026-08-05 — Neto invertido en AjusteModal para correcciones de entrada

**Síntoma:** al corregir una entrada manual hacia arriba (original=1,
cantidadReal=4), AjusteModal mostraba "Cantidad actual: -2 (original: 1)"
en vez de 4. El cálculo de DB (stock) quedaba bien; solo el número mostrado
estaba mal.

**Causa raíz:** `crearAjuste()` inserta el ajuste de entrada con
`modulo_destino_id = NULL` (1 sola punta, sin flujo bodega↔módulo). Pero
`resolverOrigenDestino()` para tipo "ajuste" asumía SIEMPRE el flujo de
2 puntas (cantidad>0 → origen=bodega, destino=módulo). Con `modulo` null,
el destino quedaba null y el origen=bodega → efecto = -|cantidad|, signo
invertido. El cálculo de DISPLAY usaba una fórmula distinta e incompatible
con el raw-sum (netaActual = original + Σ ajustes) que la misma función
usa para escribir en DB. Pre-existente en producción desde el commit
a0c2293 (23 jun), sin relación a los fixes del 5 ago. Estaba documentado
en PRD.md → "Zonas de riesgo conocidas".

**Fix:** en `resolverOrigenDestino()`, rama "ajuste", agregar el caso 1 punta
(`moduloDestinoId === null`) con el signo invertido: cantidad>0 → destino
bodega (efecto +cantidad), cantidad<0 → origen bodega (efecto -cantidad),
reproduciendo el raw-sum. La rama de 2 puntas (salida/retorno) no se toca.

**Verificación:** tsc + build verdes; suite 351 passed (los 4 fallos son
pre-existentes ajenos a ajustes). Tests nuevos fijan el display: entrada
1→4 muestra 4 (no -2), 20→18 muestra 18 (no 22), mezcla de ajustes = suma
cruda. Regresión 2-punta (R5-R7) intacta.

**No tocar sin revisar:** el discriminante del caso 1 punta es
`moduloDestinoId === null`. No modificar `resolverOrigenDestino` ni
`calcularCantidadNeta` sin mantener separados el caso 1 punta (entrada)
del de 2 puntas (salida/retorno) — hoy comparten la rama "ajuste".

## 2026-11-10 — Sync de compras Anil sumaba lineas en borrador y copias exactas (fix 1 de 4)

**Sintoma:** stock de Arjun distinto de las notas de venta impresas. Comparacion de los 188 movimientos sincronizados contra la regla validada: 149 iguales, 27 con mas, 2 con menos, 8 con productos que ya no estan en su nota. Ej. 001653: 19 codigos con lineas en borrador (+1.443 u.); 001986 EGD-100 10 (real 5).

**Causa raiz (esta parte):** `getComprasAnilDesde()` sumaba todas las filas de `itemdcto`. Vida Digital guarda lineas en borrador (`pestadot='1'`, `knumdocu`/`knumorde` NULL) que no salen en el documento impreso, y copias exactas de la misma linea (kdocitem `' 13'` vs `'13'`). Regla de negocio de Pablo: las notas o lineas en borrador no cuentan hasta que sean compras confirmadas.

**Fix:** misma regla que `lib/utils/inversion-lotes.ts` (commit e4cb0ff): `i.pestadot = '3'` + `DISTINCT ON (knumfoli, codunico, kdocitem normalizado)` por esquema, antes de las agregaciones. Solo `db/vidadigital/queries.ts`.

**Verificacion:** tsc OK; tests reales solo lectura 28/28 (001986 = 1.536 u., HR-6 1.000; 001987 = 952 u.; 001653 = oraculo pestadot 3 deduplicado). Regla validada: 214/215 notas cuadran con `movidcto.val_doc`.

**Pendiente (mismo bug, fixes aparte):** fix 0, los tests de sync escriben en produccion y fuerzan el watermark a 2026-06-15 (`__tests__/sync-compras-anil.test.ts`); fix 4, sync cortado antes de terminar; fix 3, segunda bodega del mismo producto en la misma nota se pierde por UNIQUE (folio, producto); fix 2, notas editadas despues del sync no se releen. El stock ya cargado mal se regulariza aparte, con ajustes auditados aprobados por Pablo. Nota 002515: se confirmo el 2026-11-10, coincide en cantidades con lo sincronizado.

**No tocar sin revisar:** no correr `npx vitest run` completo ni `sync-compras-anil.test.ts` hasta el fix 0: escriben en la base de produccion.

### Fix 0 (2026-11-10): tests del sync ya no escriben en produccion
`sync-compras-anil.test.ts` (sync real + watermark forzado a 2026-06-15) y `backfill-visaciones.test.ts` (backfill real sobre todos los huerfanos) reescritos con mocks de `@neondatabase/serverless`. Nuevo test guardia `tests-no-escriben-prod-sync.test.ts`. Evidencia: huella de la base propia identica antes y despues de correrlos (watermark, movimientos, visaciones, stock, productos). Siguen escribiendo en produccion (con limpieza) otros ~13 archivos de test (salidas, retornos, transferencias, usuarios, entradas, ajustes, sync-visacion, sync-imagen-merge...): no correr la suite completa hasta tener una base de pruebas separada.

### Fix 4 (2026-11-10): watermark por fecha de confirmacion (absorbe el fix 2)
Causa raiz: el watermark avanzaba por `fechanvt`, pero las notas se confirman 0-48 dias (vida) / 0-128 dias (sanjh) despues; con la regla "borradores no cuentan" una nota confirmada tarde quedaba antes del watermark y nunca entraba. Las "notas editadas despues del sync" (001986, 001987, 001976: sync 25-07, confirmacion 05-08) se habian sincronizado siendo borrador; con el fix 1 ya no ocurre, por eso el fix 2 queda absorbido. Fix: `getComprasAnilDesde` filtra `m.fechconf::date >= corte` y devuelve `fechconf`; `syncComprasAnil` avanza el watermark con `fechconf`. CLAUDE.md regla 4 actualizada. Verificacion: tsc OK, 42/42 tests permitidos, huella de produccion identica. Ninguna nota con fechanvt < 2026-06-15 se confirmo despues (sin arrastre de compras antiguas).

### Fix 3 (2026-11-10): segunda bodega del mismo producto en la misma nota
Causa raiz: la UNIQUE `uq_movimientos_folio_producto (folio, producto_id)` y el guard `existing` del sync bloqueaban la segunda bodega (ej. vida 002331 MK0-216: 2 u. Bodega 1 entraron, 13 u. Bodega 2 no). Fix: UNIQUE `uq_movimientos_folio_producto_bodega` NULLS NOT DISTINCT (folio, producto_id, bodega_origen_id), aplicada por SQL puntual (`_poc_tmp/fix3_migracion.cjs`, 0 duplicados previos; push sigue vetado); guard y fallback del sync filtran por bodega; `migrar-salidas-v1` usa `ON CONFLICT DO NOTHING`; `backfill-visaciones` indexa por folio|codigo|bodega. Verificacion: tsc OK, 48/48 tests permitidos, huella de produccion identica antes de migrar.

### Regularizacion (2026-11-10, aprobada por Pablo)
1. Sync real ejecutado con el codigo corregido (corte 2026-06-15 por fechconf): +17 movimientos / +1.913 u. legitimas (002228, 002040 incl. KF-108 Bodega 2, 002331 MK0-216 Bodega 2 + SF54 + TY-26, sanjh 003738). Watermark -> 2026-11-10.
2. 25 ajustes auditados (folio `AJT-REGSYNC-<id movimiento original>`, usuario admin, causa en observaciones; misma representacion que crearAjuste de entrada: tipo ajuste, 1 punta, cantidad con signo): neto -634 u. (HR-6 001986 +500; 001653 lineas en borrador; 001986/001987/001976 productos que no estan en la nota confirmada). Script `_poc_tmp/regul_aplicar.cjs`, residuos en `_poc_tmp/regul_residuos_aplicados.json`.
3. PENDIENTE decision de Pablo: 5 codigos de 001653 en Bodega 1 (A2 -400, GBKI-5 -120, HJ-80092-8 -30, HM-9038 -120, ZTCH-013 -120; total -790) cuyo exceso es mayor que el stock actual de Bodega 1. Las lineas en borrador de 001653 son copia de lineas de la nota confirmada 001691 (mismas cantidades, Bodega 2). La diferencia viene de salidas V1-SAL (migradas de la v1, 29-05 a 06-06) que descontaron de Bodega 1 mercaderia anterior nunca ingresada en la v2. Restar todo deja la bodega negativa.

## 2026-11-10 — Conciliacion en produccion mostro 203 diferencias falsas

**Sintoma:** primer "Sincronizar" con `conciliacion_compras=true`: "203 diferencias en 27 notas (app 20386 u. vs VD 632 u.)".

**Causa raiz:** ventanas distintas en cada lado. `syncComprasAnil` inicializa la key `compras-anil-desde` con el `corte` del sync (`ON CONFLICT DO NOTHING`), y el watermark ya estaba en 2026-11-10: el lado VD compara solo notas confirmadas desde hoy (002515, 632 u.), mientras `getLineasApp` trae TODAS las entradas sincronizadas de la app (desde 2026-06-23). La prueba previa en produccion uso `desde=2026-05-01` y no lo revelo.

**Fix de datos (Director):** `UPDATE sync_watermark SET value='2026-05-01' WHERE key='compras-anil-desde'` (inicio de los datos sincronizados). Resultado esperado: 5 diferencias (los 5 codigos pendientes de 001653), igual que `_poc_tmp/conciliacion_prod_0501.json`.

**Pendiente (fix de codigo, requiere aprobacion):** acotar el lado app a la misma ventana para que no dependa de como se inicializa la key, e inicializar la key con el inicio real de los datos y no con el corte incremental. Tras el corte de inventario (app vacia + key = fecha de corte) el problema no se presenta, pero el codigo no debe depender de eso.

### Fix de codigo (2026-11-10, aprobado por Pablo)
`conciliarComprasAnil` acota el lado app con `acotarLineasApp`: una linea se compara si su folio esta en el lado VD o si entro a la app desde `desde` (`MIN(created_at)`). Verificado en produccion (solo lectura): desde 2026-05-01 -> 5 diferencias (001653, esperadas). Limite conocido: si el sync procesa notas confirmadas ANTES de `desde` (solo en regularizaciones manuales como la del 2026-11-10), esas lineas aparecen como diferencia con motivo `fuera_de_desde`; despues del corte de inventario no ocurre porque el sync solo trae fechconf >= watermark >= desde.
# 2026-11-17 — BACKLOG baja: acceso denegado sin navegacion

- Fuente: QA inv-01-deep2 EXP-1, reproducido por Director. /usuarios con operador responde 403 correcto,
  pero el texto "No autorizado" queda fuera del layout y obliga a volver por navegador/URL.
- Preexistente en proxy.ts, sin relacion con el contrato de ubicaciones. No compromete permisos.
- Pendiente: pantalla de acceso denegado con enlace al inicio; mantener 403 y acceso restringido.
- QA inv-02 EXP-5: operador en /inversion-mercaderia recibe notFound con texto ingles de Next.js.
  Mejora baja de localizacion, comportamiento previo deliberado de ocultar inversion a no-admin.
- QA inv-13-on EXP-1: /productos/abc muestra el mismo 404 generico en ingles, dentro del encabezado nuevo pero sin enlace de retorno. Confirmado por Director con notFound de Next; agregar pantalla localizada con retorno antes UAT. El HTTP404 por ese ID invalido es correcto.

## 2026-11-17 — BACKLOG baja: comodines en buscador anterior
- QA inv-03 EXP-1: `%` devuelve todo el listado. Causa verificable: getProductos aplica ILIKE
  parametrizado `%${q}%` sin escapar comodines de usuario. No es inyeccion SQL ni cambio de inv-03.
- El nuevo buscador debe tratar `%` y `_` como caracteres literales; incluir fixture y regresion al tocarlo.


## 2026-11-18 — BACKLOG modo nuevo: cerrar resultados al ver todas
- Fuente auditoria inv-audit-09-2-A hallazgo1, confirmado Director en componentes/inventario/BuscadorInventario.tsx.
- Link Ver todas las coincidencias carece onClick/onElegir; shell persiste entre ficha e inventario. Puede quedar dropdown de busqueda anterior encima de lista nueva.
- Fix minimo previsto: llamar onElegir igual que links producto, con prueba rojo evento y QA ficha->VerTodas->lista sin dropdown (antes cerrar UIconteo/UAT). Flag nuevo siguefalse enentregaactual.

## 2026-11-18 — BACKLOG baja: conservar termino al enviar busqueda
- QA inv17-2-on EXP-1. Director confirma enviar() llama elegir()/setQ vacio antes router.push; el filtro sigue aplicado y visible en el titulo de resultados.
- Revisar antes UAT junto retorno/filtros: conservar termino editable al enviar o Ver todas, cerrar desplegable; elegir producto puede limpiar busqueda. Sin perdida de datos ni bloqueo del flujo actual.

## 2026-11-18 — Pendiente permisos server-actions Usuarios antes UAT (R8)
- Evidencia estatica Director: lib/actions/usuarios.ts crearUsuario solo verifica rol si recibe requestUserId opcional; page llama sin ese argumento. Funcion no llama auth; listarUsuarios tampoco verifica sesion/rol. Proxy protege la ruta, no se ha reproducido aqui una explotacion HTTP ni se afirma incidente de produccion.
- Contratar y probar guardas reales de sesion/admin dentro de ambas funciones antes DB, sin confiar en actor enviado por cliente; revisar callers y __tests__/usuarios.test.ts. Relacionado con requisito Usuarios solo admin, antes UAT. No hay eliminacion de usuarios en esta API, por lo que no hay impacto de FK conteos sobre un flujo de borrado existente.

## 2026-11-18 — ARREGLADO c51cff5: busqueda espera guardado (modo inventario)
- Director reprodujo con respuesta de conteo retenida despues commit TEST: busqueda permanece esperando2s; al liberar respuesta inicia su POST y aparecen coincidencias. Fuente: BuscadorInventario usa Server Action; cola Next16 app-router-instance.js104-160 serializa acciones. No perdida de conteo.
- FREEZE respaldo stash80489094099d7b2a9e9fa841232c7d96cc45e79d creado y reaplicado; codigo restaurado. Primera hipotesis confirmada, ningun fix intentado.
- Corregir lectura de sugerencias mediante GET autenticado independiente; repetir respuesta tardia/reintento/navegacion/borrador99 antes cerrar17.3b.

- Cierre2026-11-19: GET independiente/c51cff5, prueba real de respuesta retenida+cambioSKU+99/replay PASA; QA searchON/OFF PASA y DirectorOFFPASA. Ver AUTO-LOG/TRASPASO. VerTodas también corregido c51cff5; conservar término al enviar sigue BACKLOG separado.

## 2026-11-19 — BACKLOG media: errores esperados de Usuarios se lanzan como excepcion (antes UAT)
- QA inv-usuarios-r8-on EXP-3: crear username duplicado muestra "El username ya existe" en dev, pero la server action responde 500. Preexistente: el throw de duplicado no cambio en UsuariosR8.
- Next.js recomienda modelar errores esperados como valor de retorno; en build de produccion reemplaza el mensaje lanzado por uno generico con digest. En prod el admin probablemente veria un mensaje generico en vez de "El username ya existe" (no reproducido aun en build prod).
- Propuesta: slice chico devolviendo {ok:false,error} para duplicado/validacion en crearUsuario y mostrarlo en page; la guarda "No autorizado" puede seguir lanzando (no es flujo de usuario legitimo). Verificar con next start antes de UAT.

## 2026-11-19 — ARREGLADO c6878dc: permisos server-actions Usuarios (R8)
- Causa raiz: crearUsuario autorizaba solo si el cliente enviaba requestUserId opcional y listarUsuarios no verificaba sesion. Fix: exigirAdmin() con auth() antes de SQL en ambas, DTO sin hash, sin actor de cliente.
- Evidencia: rojo B 10 fallos -> 29/29 verdes; replay Director de server actions como operador/anonimo con control positivo admin (verificar-usuarios-r8-arjun.cjs) PASA; QA ON 4/4 y OFF 1/1. Limitacion declarada: rol del JWT firmado hasta renovar sesion.

## 2026-11-20 — BACKLOG baja: editor legado OFF no refresca tarjeta tras guardar
- QA inv-15-off EXP-1: tras "Cambios guardados correctamente" la tarjeta superior de /productos/[id] muestra valores viejos hasta recargar. Preexistente: form.tsx/updateProducto sin revalidatePath; inv-15 no lo toco por contrato. Incluir revalidatePath/refresh en el contrato del editor nuevo de ficha (alias/packing/observaciones) antes de UAT.

## 2026-11-20 — PREGUNTA UAT: vaciar alias/packing/observaciones desde el editor
- inv-19.1: en el editor nuevo (y el legado) un campo vacio significa "no cambiar"; no se puede borrar un alias u observacion. Decision Director (opcion a): mantener por R15 "restricciones actuales" y no tocar el schema compartido con PATCH OFF. Consultar a Pablo en UAT si quiere permitir borrar (schema aceptando null, ~10 lineas + tests).
- Correccion documental: la entrada antigua que dice que packing acepta 0 (nonnegative) esta desactualizada; el codigo real exige packing entero > 0 (lib/validations/producto.ts, productos-update-validacion.test.ts).

## 2026-11-20 — ARREGLADO 12c337b: editor de ficha bloqueado ante rechazo y sin key
- Auditoria inv-audit-19-1-A B1/B2. Causa raiz: crearGuardar sin catch y onClick sin finally (boton "Guardando..." permanente si la server action rechaza); EditorFichaProducto sin key (riesgo de datos cruzados al navegar ficha a ficha). Fix: mensaje fijo + finally; key usuario+producto. Rojo 2 -> 22/22, QA 2/2.

## 2026-11-20 — BACKLOG release: subida de imagen 4.5-10MB falla en Vercel
- Auditoria inv-audit-19-1-A A2: MAX_SIZE 10MB (lib/cloudinary.ts) supera el limite de body de 4.5MB de Vercel Functions (docs Vercel: no configurable, 413 FUNCTION_PAYLOAD_TOO_LARGE). imagen.tsx hace res.json() sin guardia -> error "Unexpected end of JSON input" (misma clase que 2026-08-05). Antes de UAT: bajar limite por debajo de 4.5MB con mensaje claro y/o comprimir en cliente o subir directo a Cloudinary; guardar res.ok antes de json.

## 2026-11-20 — BACKLOG baja (auditoria 19.1): higiene y auditoria
- B3: __tests__/productos-update-validacion.test.ts usa codigo fijo TEST-UPD-001 sin afterAll (solo TEST). Migrar a tag unico + cleanup por id.
- B4: auditoria update_codigo_personal guarda valor_anterior null (lib/actions/productos.ts). Opcion: leer valor previo si la auditoria debe reconstruir cambios.
- Ponytail opcional: formateador de posicion duplicado FichaProducto/HistorialConteos; harness de hooks React duplicado en tests; filtro conteo_id redundante en consultas.ts.

## 2026-11-20 — BACKLOG baja: "Sacar otra foto" sin foto previa no hace nada
- QA inv-20-3-off EXP-1 (preexistente, ambos modos): en /entradas/identificar el boton reiniciar no cambia nada si no hay foto. Opcion: ocultarlo hasta que exista foto o resultado.

## 2026-11-20 — ARREGLADO (commit fix auditoria 20.3): imagen sin key, ruta imagen 500 no-JSON, alert duplicado, crearProductoManual rechazaba, tope 10 codigos
- Ver AUTO-LOG. Rojo 7 -> 88/88, QA regresion imagen ON/OFF PASA.

## 2026-11-20 — BACKLOG (decision schema): codigos que difieren solo en mayusculas
- Auditoria inv-audit-20-3-A #5/#7: primerIdLocal resuelve sin mayusculas, pero UNIQUE(codigo) y upsertProducto son exactos. En carrera con el sync (ABC vs abc) pueden quedar dos productos y abrirProductoIdentificado puede informar incorporado:true con metadata nula. No es regresion (crearEntrada ya usaba el mismo upsert). Fix real: indice unico upper(btrim(codigo)) en migracion aparte, previa verificacion de duplicados existentes en TEST y produccion (produccion: solo lectura hasta Senal3). Nunca drizzle-kit push.

## 2026-11-20 — BACKLOG defensa en profundidad: acciones de lectura legacy sin gate de modo
- inv-21 decision Q5: getMovimientos/getProductos/getBodegas/vistas siguen invocables via next-action forjado aunque sus paginas esten apagadas en ON (las server actions se pueden invocar replicando el id, demostrado en R8). Mutaciones legacy ya cortadas por exigirModoOperativo; las lecturas exponen lo mismo que hoy a usuarios con sesion. Evaluar gate de modo en lecturas antes de release si se quiere ocultar datos legacy.

## 2026-11-20 — BACKLOG baja (latente): getComprasAnilDesde con nro_ingreso null
- Detectado por Programador en 22b-1 (preexistente): el mapa de visaciones indexa `${nro}` (null -> "null") pero el lookup usa `nro ?? ""` -> undefined -> crash. Medicion Director read-only en VD 2026-11-20: 0 filas con knumezet null (vida 466, sanjh 1017). Latente; corregir con guarda cuando se toque esa funcion o antes de release.

## 2026-11-20 — RIESGO release: duracion del sync ON en Vercel
- 22b-3: cada fila hace ~3 consultas HTTP a Neon. Lote 100 + guarda 8 s. Docs Vercel actuales: Fluid compute 300 s por defecto en todos los planes; sin Fluid, Hobby 10 s (hasta 60 s). No verificado que modo usa el proyecto. Si un dia con muchas filas tardara > 8 s, el watermark no avanzaria (re-lee el mismo dia). Medir en UAT el tiempo real por corrida (respuesta procesadas/pendientes) y ajustar LIMITE_MS o maxDuration antes de activar cron-job.org.

## 2026-11-20 — BACKLOG baja (tests): harness del sync borra keys globales de sync_watermark en TEST
- __tests__/helpers/sync-on-harness.ts limpia 'compras-anil-ledger' (y lease) en beforeAll/afterAll. Cada corrida de esos tests reinicia el backfill del ledger en la rama TEST (observado 2 veces por el Director; idempotencia del ledger confirmada: replays con 0 inserciones). Solo TEST. Fix: snapshot y restore del valor previo en vez de DELETE.

## 2026-11-20 — ARREGLADO bec410a / 46e01c1 / 51342c3 (22d): fetch sin contexto, hora +3h, guarda dia lleno
- Reproducidos por el Director con backfill real en TEST (boton y ruta). Ver commits.

## 2026-11-20 — Backlog auditoria inv-audit-22e-A (no bloqueante)
- D3 duracion: sync ON hace ~3 round trips por linea (100/lote). Estado estable <=55 lineas/dia (~7 s); backfill inicial via ACTUALIZAR (maxDuration 60). Si Vercel mide >25 s por corrida: INSERT set-based (unnest) o lote menor.
- D5 ledger insert-only: correcciones posteriores de una compra en Vida Digital no se reflejan (costo original). Decision Director; revisar en UAT antes de valorizar.
- D6 tests: DDL de 0004 en beforeAll de varios archivos puede chocar en paralelo (solo tests).
- ACTUALIZAR disponible para cualquier sesion (no solo admin): revisar en UAT.
- syncComprasAnil(corte,{modo:"on"}) es entrada solo-tests y omite el lease; sin caller productivo.
- Harness de tests borra la key global compras-anil-ledger en TEST (ya anotado); el Director la restaura tras correr la suite.

## 2026-11-20 — Backlog inv-24 (no bloqueante)
- ProductoThumbnail sin marcador cuando la imagen de Cloudinary da 404 (visto en TEST con XL-0300). Baja.
- compras_importadas sin CHECK de cantidad/precio >= 0: el calculo aisla el producto con datos invalidos (inv-24-fix) y lo informa; CHECK en DB requiere migracion prod (decidir en release). Medido TEST: 0 negativos/null.
- Valorizacion de la lista ~770 ms desde PC Pablo (3 consultas a us-east); revisar en Vercel durante UAT.

## 2026-11-20 — BACKLOG tests: identificacion-arj.test.ts falla al importar (preexistente)
- Visto por el Director en la corrida amplia de inv-27: "Cannot read properties of undefined (reading 'query')" en db/index.ts al importar lib/actions/productos; el mock de @neondatabase/serverless no expone lo que drizzle neon-http necesita. inv-27 no toca lib/actions ni db. Archivo fuera de las suites del modo inventario; arreglar el mock antes del release (lint/test global).

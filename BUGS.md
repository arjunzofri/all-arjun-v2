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

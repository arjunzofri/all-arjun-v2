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

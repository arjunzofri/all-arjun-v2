# CONTEXT-CLAUDE-CHAT.md — app-arjun-v2

Pegar este documento al inicio de una conversación con Claude (Director
Técnico) cuando se necesite tomar decisiones de arquitectura, diseñar un
nuevo slice, o resolver un problema que excede el alcance de un ciclo
PBT-IA en Claude Code.

---

## Qué es este proyecto

App Arjun v2 — reconstrucción completa del sistema de inventario de Anil
Chandnani Import Export EIRL (Mall Zofri, Iquique). Reemplaza a la v1
(`app-arjun`), que fue descontinuada por duplicación crónica de stock
causada por un sync mal diseñado contra WinFac Arjun directo
(`arjun.inv_sdo`).

**Repos y proyectos — todo separado de la v1, sin overlap:**
- Repo: `app-arjun-v2` (local: `C:\Users\pablo\Documents\app-arjun-v2`)
- Vercel: proyecto nuevo `app-arjun-v2`
- Neon: base de datos propia, nueva, sin relación con la base de la v1

## Por qué existe la v2 (causa raíz del problema en v1)

1. El sync de v1 leía `arjun.inv_sdo` (réplica WinFac de Arjun) y asignaba
   bodega con lógica que en algún punto quedó hardcodeada a "Bodega Arjun"
   para todo, ignorando el vendedor real.
2. Se corrigió el routing por vendedor, pero el sync seguía duplicando
   stock por errores de cálculo de delta y por reprocesamientos manuales
   que no usaban la misma lógica que el sync principal.
3. Tras múltiples ciclos de fix-sobre-fix, se decidió abandonar
   `arjun.inv_sdo` como fuente y leer en su lugar **directamente la base
   de Vida Digital**, que ya tiene los datos de compras de Anil
   consolidados y correctos (usada en producción por la app
   `inventario-arjun` sin estos problemas).

## Arquitectura de datos — verificada con queries reales, no asumida

Existe una base Neon llamada "Vida Digital" que NO es de App Arjun. Es
externa, compartida, de **solo lectura** para nosotros. Contiene:

- **Schema `vida`**: réplica raw de WinFac Vida Digital
  (`itemdcto`, `movidcto`, `inventar`, etc.)
- **Schema `sanjh`**: réplica raw de WinFac Sanjh/San Jorge — misma
  estructura de columnas que `vida` en `itemdcto`/`movidcto`
- **Schema `public`**: capa procesada por la app Vida Digital, que unifica
  productos de ambas empresas:
  - `public.productos` (empresa_id=1 → Sanjh, empresa_id=2 → Vida Digital)
    con `saldo`, `cantcaja` (packing), `detalle` (descripción),
    `nroingreso`
  - `public.ubicaciones_bodega` con conteo físico y ubicación interna

### Cómo se identifican las compras de Anil

```sql
-- En vida.movidcto Y en sanjh.movidcto (mismo filtro en ambos)
WHERE tipomovi = 'V'
  AND kcodcli2 IN (2, 20, 218)   -- los 3 códigos de cliente de Anil
```

Cruzando `itemdcto.codunico` con `movidcto.knumfoli`, y luego con
`public.productos.codigo` para traer metadata.

### Cómo se determina la bodega de destino

El 5° segmento (separado por `-`) de `nroingreso` (en `public.productos`)
o `knumezet` (en `vida.itemdcto`/`sanjh.itemdcto`) indica el código de
bodega origen:

| Código | Sistema origen | Bodega destino en App Arjun v2 |
|---|---|---|
| `GLP` | Vida Digital | Bodega 1 Vida Digital |
| `GL1` | Vida Digital | Bodega 2 Vida Digital |
| `GL2` | Sanjh | Bodega 1 Vida Digital (administrativo, sin bodega física propia, confirmado con Pablo) |

Anil compra activamente a ambos proveedores hasta la fecha actual — no es
un caso histórico cerrado, ambos siguen con movimiento.

### Fecha de corte para el sync automático

**Solo se sincronizan automáticamente compras con `fechanvt >= '2026-06-01'`.**//
Todo lo anterior a esa fecha no entra por el sync — si hay mercadería física
de compras más antiguas que necesita regularizarse en el inventario, se
ingresa manualmente usando el buscador histórico (que sí busca en todo el
histórico sin filtro de fecha, pero solo trae código/descripción/imagen,
nunca cantidad).

## Decisiones de diseño ya tomadas (no reabrir sin nueva evidencia)

- Kingnex/OCR: descartado completamente, no entra en ningún MVP.
- GL2 no es una bodega física — confirmado con Pablo, se consolida en
  Bodega 1 Vida Digital.
- Sanjh no tiene tabla de productos usable (`sanjh.producto` es catálogo
  de vehículos/maquinaria sin saldo/packing) — la metadata para productos
  de Sanjh viene igual de `public.productos` (empresa_id=1), que ya está
  sincronizada desde `sanjh.inventar` por la app Vida Digital.
- No se migran datos históricos de stock de la v1. App Arjun v2 arranca en
  cero; el stock real se reconstruye vía sync (desde 1 junio 2026) +
  ingresos manuales para lo anterior.

## Estado del backlog (actualizado 2026-06-19)

| Slice | Commit | PRD | Descripción | Estado |
|---|---|---|---|---|
| 01 | `877a5f5` | 5.9 | Scaffold: Next.js 16, Drizzle schema (7 tablas), NextAuth v5, proxy.ts, Inter font, env vars, vitest setup | ✅ Completo |
| 02 | `0c43c1f` | 5.1, 5.2 | Queries Vida Digital: `getComprasAnilDesde()`, `buscarProductoHistorico()`, `getBodegaPorCodigoIngreso()` | ✅ Completo |
| 03 | `f4527c0` | 5.1 | Sync automático: `syncComprasAnil()`, CTE atómica, idempotencia UNIQUE, watermark, endpoint con CRON_SECRET | ✅ Completo |
| 04 | `2decdf8` | 5.2, 5.3 | API productos: GET paginado, GET ficha + historial, PATCH editar + auditoría, GET buscar-historico, Zod | ✅ Completo |
| 05 | `b143b1f` | 5.4 | Entradas manuales: `crearEntrada()` con CTE atómica, idempotencyKey, página `/entradas` | ✅ Completo |
| 06 | `5c01ab1` | 5.9 | Usuarios: UI `/usuarios`, autorización por rol, crear/editar usuarios, login con bcrypt | ✅ Completo |
| 07 | `13eebd7` | 5.5 | Salidas (Bodega → Módulo): descuento + incremento atómico en CTE, idempotencia, página `/salidas` | ✅ Completo |
| 08 | `c2320ce` | 5.6 | Retornos (Módulo → Bodega): operación inversa a salida, misma CTE atómica, página `/retornos` | ✅ Completo |
| 09 | `cb089cc` | 5.7 | Vistas `/bodegas`, `/modulos`: listado paginado con cursor, filtro "solo con stock", ubicaciónId dinámico | ✅ Completo |
| 10 | `80bcb9d` | 5.3 | UI productos: página `/productos`, ficha detalle, imágenes Cloudinary, editar producto | ✅ Completo |
| 11 | `3bf5993` | 5.8 | Historial global de movimientos: `/movimientos` con filtros por tipo, fecha, bodega | ✅ Completo |
| 12 | `c342e96` | 5.9 | Auth desde cero: username + password, DrizzleAdapter eliminado, JWT session strategy | ✅ Completo |
| — | `a42b51f` | — | Fix: eliminar tests flaky, aislar suites | ✅ Completo |
| — | `997eacd`…`7cc785b` | — | Ponytail-review Grupos 1-4: eliminar código muerto, refactors internos, unificar queries, mover constantes | ✅ Completo |
| — | `758b257` | — | UX: botón de logout en sidebar con SVG inline | ✅ Completo |
| — | `aac54aa`…`bdaaeed` | — | `/productos`: búsqueda en vivo con debounce + paginación "Cargar más" | ✅ Completo |
| — | `af1d5ef`…`69f165f` | — | `UbicacionDetalle`: debounce 250ms en buscador + error handling en `cargar()` | ✅ Completo |
| — | `9c79918`…`d4f3105` | — | `/productos`: persistencia de búsqueda en URL (`?q=`) + botón "Volver" preserva filtro vía `refQ` | ✅ Completo |
| — | `a652d73`…`43e78f3` | — | Fix: `"use server"` faltante en `productos.ts` + URL `?q=` vacío persistente | ✅ Completo |

## Último slice completado

2026-06-19 — refQ: botón "Volver" en detalle preserva filtro de búsqueda (`d4f3105`)

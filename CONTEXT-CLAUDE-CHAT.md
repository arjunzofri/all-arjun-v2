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

## Estado del backlog

(Actualizar manualmente esta sección a medida que se completan slices)

- [ ] Sesión 0 completada — PRD.md, CLAUDE.md, este archivo, script
      PowerShell generados
- [ ] Setup inicial: repo, Neon nueva, Vercel, schema base
- [ ] Slice: schema de productos + bodegas + módulos
- [ ] Slice: conexión read-only a Vida Digital + query de compras Anil
      (UNION vida + sanjh, filtro fecha, mapeo bodega)
- [ ] Slice: job de sync automático con watermark/idempotencia
- [ ] Slice: buscador histórico para ingreso manual
- [ ] Slice: CRUD productos + imágenes + compresión Cloudinary
- [ ] Slice: entradas manuales
- [ ] Slice: salidas (bodega → módulo) con CTE atómica
- [ ] Slice: retornos (módulo → bodega)
- [ ] Slice: vistas /bodegas, /modulos con paginación por cursor estable
- [ ] Slice: historial de movimientos
- [ ] Slice: auth + roles + activity log

## Último slice completado

(Actualizar manualmente después de cada commit aprobado)

Ninguno — proyecto recién generado en Sesión 0.

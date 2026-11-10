# CLAUDE.md — app-arjun-v2

## Stack decidido

- Next.js 16 (App Router), React 19, TypeScript 5.9
- Tailwind CSS v4, shadcn/ui, Inter font
- Drizzle ORM
- Neon PostgreSQL — **base propia, nueva**, separada por completo de la v1
- NextAuth v5
- Cloudinary (carga de imágenes con compresión antes de subir)
- Vercel — proyecto nuevo `app-arjun-v2`, deploy automático en push a `main`

## Conexión de solo lectura a Vida Digital

Existe una segunda conexión, **read-only**, a una base externa que no es
propiedad de esta app:

```
VIDADIGITAL_DATABASE_URL=<connection string de Neon Vida Digital>
```

Esta conexión se usa exclusivamente para:
1. El sync automático de compras Anil (`db/vidadigital/queries.ts` →
   `getComprasAnilDesde(fecha)`)
2. El buscador histórico para ingreso manual (`buscarProductoHistorico(query)`)
3. La valorización FIFO de inversión (`lib/utils/inversion-lotes.ts`)
4. El catálogo de identificación por foto (`getCatalogoVidaDigital()` y
   `getCatalogoIdentificacion()`)

**Regla dura: nunca se escribe en `VIDADIGITAL_DATABASE_URL`.** Es de solo
lectura, siempre. Cualquier mutación de stock ocurre exclusivamente en la
base propia de app-arjun-v2.

## Comandos de desarrollo

```bash
npm run dev          # desarrollo local
npm run build         # build de producción
npm run lint          # eslint
npx tsc --noEmit       # type check
npx vitest run         # tests
npx drizzle-kit push   # aplicar cambios de schema a Neon
```

`npx vitest run` usa la rama Neon **"test"** vía `TEST_DATABASE_URL`
(`vitest.setup.ts` la exige y aborta si falta o si coincide con el host de
producción). Para refrescar la rama desde production:
Neon Console > Branches > test > Reset from parent.

## Estructura de carpetas

Ver sección 10 de PRD.md — estructura completa documentada ahí. Resumen:
- `app/(dashboard)/` — páginas autenticadas
- `app/api/` — endpoints, incluyendo `sync/compras-anil` (reemplaza
  `sync/winfac` de v1 — **ese nombre y esa lógica no se replican aquí**)
- `db/vidadigital/` — conexión read-only + queries contra Vida Digital
- `db/schema.ts` — schema propio de app-arjun-v2
- `lib/utils/get-bodega-por-codigo-ingreso.ts` — mapeo GLP/GL1/GL2 → bodega

## Naming conventions

- Tablas y columnas en `snake_case` (Postgres).
- Archivos de componentes en `PascalCase.tsx`.
- Server actions y utils en `camelCase.ts`.
- Tests en `__tests__/<nombre-feature>.test.ts`, espejando el nombre del
  archivo o feature que cubren.

## Reglas no negociables

1. **Toda mutación de stock usa CTE atómica con `FOR UPDATE` y aritmética
   server-side.** Nunca leer-calcular-escribir en pasos separados desde la
   capa de aplicación — Drizzle + Neon HTTP driver tiene fallos silenciosos
   comprobados en ese patrón.
2. **El filtro de corte (`knumezet >= valor`) solo es válido dentro de la
   lógica de sync.** Nunca aplicar ese tipo de filtro en vistas de
   `/bodegas`, `/modulos`, buscadores generales — bloquea productos
   legítimos.
3. **Paginación con cursor estable:** usar `id` único (no timestamp) como
   cursor, con `ORDER BY id DESC` consistente entre la condición del cursor
   y el `ORDER BY`. La v1 tuvo dos bugs de paginación distintos por mezclar
   estos criterios.
4. **El sync de compras Anil usa fecha de corte dinámica, determinada por
   `sync_watermark.value` para la key `compras-anil`, y esa fecha es la de
   CONFIRMACIÓN (`movidcto.fechconf`), no la de la nota (`fechanvt`).** Cada
   sync trae las compras confirmadas desde esa fecha inclusive (la idempotencia
   folio+producto evita duplicar); una nota confirmada tarde entra aunque su
   `fechanvt` sea anterior al watermark. Las notas en borrador no tienen
   `fechconf` y no entran hasta confirmarse. No se sincroniza automáticamente
   nada anterior a ese valor. Mercadería más antigua
   se regulariza solo vía ingreso manual con el buscador histórico (que sí
   consulta todo el histórico, sin filtro de fecha, pero solo para traer
   metadata — nunca cantidades).
5. **Mapeo de bodega por código de ingreso:** `GLP` → Bodega 1 Vida Digital,
   `GL1` → Bodega 2 Vida Digital, `GL2` → Bodega 1 Vida Digital (administrativo,
   sin bodega física propia). Este mapeo vive en una sola función,
   `getBodegaPorCodigoIngreso()`, nunca duplicado inline en múltiples
   endpoints.
6. **Nunca asumir overlap de IDs entre tablas distintas.** Si una tabla
   tiene su propio PK (ej. `stock.id`), no usarlo intercambiablemente con
   el PK de otra tabla (ej. `productos.id`) en cursores o joins sin
   verificar explícitamente la relación.
7. **Páginas server component que muestran datos de DB → `force-dynamic`.**
   Toda página nueva que sea server component y renderice datos agregados
   o numéricos de la DB debe incluir `export const dynamic = "force-dynamic"`.
   Verificar en el output de `npm run build`: si la ruta aparece como
   `○ Static` y muestra datos de DB, está congelada al momento del build
   y nunca se actualizará hasta el próximo deploy. Client components con
   shell vacío que fetchean datos al montar (`"use client"` + `fetch` o
   server action en `useEffect`) no necesitan esto — su HTML estático es
   solo el esqueleto, sin datos. Si un solo INSERT de productos escribe
   su propio SQL en vez de reusar `upsertProducto`, es el mismo patrón
   que ya causó dos bugs (sync y entrada manual).

## Referencia

Ver `PRD.md` para alcance funcional completo y `CONTEXT-CLAUDE-CHAT.md`
para contexto de arquitectura a pegar en sesiones con el Director Técnico
(Claude chat).

## Entorno QA (Fase E — ver ~/.claude/PBRAVOT-QA.md)
- Configuracion: `.pbravot/qa-entorno.json`. CUIDADO: `.env.local` apunta a PRODUCCION; el entorno de
  QA redirige `DATABASE_URL` a `TEST_DATABASE_URL` (rama Neon "test") y se niega a arrancar si
  ambas apuntan al mismo host.
- Levantar: `& "$HOME\.claude\pbravot\qa-entorno.ps1" -Repo . -Accion levantar` (http://localhost:3123)
- Cuentas sinteticas: `.pbravot/qa-preparar.mjs` crea qa-admin y qa-operador en la rama de pruebas y
  las deja en `..\_dt\qa\cuentas.json`.
- Datos: la rama de pruebas cambia entre corridas; los casos se escriben con valores relativos.
- Fuera de QA local: "Identificar por foto" (requiere claves de Gemini, API de pago).
- Detener: `-Accion detener` (restaura next-env.d.ts).
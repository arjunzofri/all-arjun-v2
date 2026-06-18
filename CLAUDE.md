# CLAUDE.md — app-arjun-v2

## Stack decidido

- Next.js 15 (App Router), React 19, TypeScript 5.9
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

## Reglas no negociables heredadas del historial de la v1

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
4. **El sync de compras Anil tiene fecha de corte fija: `>= 2026-06-01`.**
   No se sincroniza automáticamente nada anterior. Mercadería más antigua
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

## Referencia

Ver `PRD.md` para alcance funcional completo y `CONTEXT-CLAUDE-CHAT.md`
para contexto de arquitectura a pegar en sesiones con el Director Técnico
(Claude chat).

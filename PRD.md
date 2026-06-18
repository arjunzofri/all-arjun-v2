# PRD.md — App Arjun v2

## 1. Qué es el proyecto

App Arjun v2 es la reconstrucción completa del sistema de control de inventario
de Anil Chandnani Import Export EIRL, que gestiona el flujo de mercadería entre
bodegas de origen y módulos de venta en Mall Zofri, Iquique.

Esta v2 reemplaza por completo a la v1 (`app-arjun`), que sufrió duplicación
crónica de stock por un sync mal diseñado contra WinFac Arjun. La v2 elimina
esa fuente de datos y en su lugar lee directamente — de solo lectura — la base
Neon de Vida Digital, que ya consolida las compras reales de Anil tanto a
Vida Digital como a Sanjh (San Jorge / WinFac).

## 2. Contexto de negocio (verificado, no asumido)

- Anil compra mercadería a dos proveedores: **Vida Digital** y **Sanjh**.
- Ambos proveedores comparten una única base Neon ("Vida Digital"), con
  schemas separados (`vida`, `sanjh`) más una capa procesada común
  (`public.productos`, `public.ubicaciones_bodega`) que unifica productos de
  ambas empresas (`empresa_id=1` Sanjh, `empresa_id=2` Vida Digital).
- Las compras de Anil se identifican filtrando `tipomovi='V'` y
  `kcodcli2 IN (2, 20, 218)` en `vida.movidcto`/`itemdcto` y
  `sanjh.movidcto`/`itemdcto`.
- El número de ingreso (`nroingreso` / `knumezet`) tiene 5 segmentos separados
  por guion; el 5° segmento indica la bodega de origen:
  - `GLP` → Bodega 1 Vida Digital
  - `GL1` → Bodega 2 Vida Digital
  - `GL2` → Bodega 1 Vida Digital (código administrativo heredado de Sanjh,
    sin bodega física propia — se consolida en Bodega 1)
- Anil sigue comprando activamente a ambos proveedores hasta la fecha actual.
- Cualquier compra a un proveedor distinto de Vida Digital o Sanjh se ingresa
  100% manualmente — no hay integración automática para terceros.

## 3. Usuarios

- **Operador de bodega:** registra salidas (bodega → módulo), retornos
  (módulo → bodega), consulta stock, hace ingresos manuales.
- **Admin (Pablo):** todo lo anterior + gestión de productos, revisión de
  historial completo, administración de usuarios.

Todos los usuarios requieren login. Toda acción queda trazada con usuario y
timestamp.

## 4. Definición de bodegas y módulos

**Bodegas de origen:**
- Bodega 1 Vida Digital
- Bodega 2 Vida Digital
- Bodega Arjun (stock propio, no asociado a Vida Digital/Sanjh — alimentado
  100% manual)

**Módulos de venta (Mall Zofri):**
- Módulo 180, 182, 183, 184, 193

## 5. MVP — Backlog priorizado

### 5.1 Sync automático de compras (reemplaza WinFac Arjun)

- Job programado (cron) que lee, de la base Vida Digital (solo lectura):
  - `vida.itemdcto` + `vida.movidcto` UNION `sanjh.itemdcto` + `sanjh.movidcto`
  - Filtro: `tipomovi='V'`, `kcodcli2 IN (2, 20, 218)`,
    **`fechanvt >= '2026-06-01'`** (fecha de corte fija — no se sincroniza
    nada anterior a esta fecha)
  - Cruce con `public.productos` + `public.ubicaciones_bodega` por
    `codigo`/`nroingreso` para obtener saldo, packing (`cantcaja`),
    descripción (`detalle`)
  - Mapeo de bodega por 5° segmento de `nroingreso`/`knumezet`:
    `GLP`/`GL2` → Bodega 1 Vida Digital, `GL1` → Bodega 2 Vida Digital
  - Crea entradas con cantidad real, producto, bodega destino, timestamp
  - Usa watermark (último `fechanvt` o folio procesado) para evitar
    reprocesar — diseño de delta a definir en Fase A del primer slice,
    con foco explícito en **no repetir el bug de duplicación de v1**
    (cada NV se procesa una sola vez, idempotencia verificable por test)

### 5.2 Buscador histórico para ingreso manual

- Autocompletado en `/entradas` (modo manual) que busca en **todo el
  histórico** de compras de Anil a Vida Digital + Sanjh (sin filtro de
  fecha), trayendo solo `codigo`, `detalle` (descripción) e `imagen` —
  nunca cantidad ni bodega automática.
- El usuario completa manualmente cantidad y bodega destino al usar este
  autocompletado. Sirve para regularizar mercadería comprada antes del
  1 de junio de 2026 o cualquier caso no cubierto por el sync automático.

### 5.3 Maestro de productos

- Ficha de producto: código, descripción, código personal (alias), packing,
  ubicación (con herencia: nuevo ingreso del mismo código hereda ubicación
  ya registrada), observaciones, imágenes.
- Auditoría de quién/cuándo modificó el código personal.
- Carga manual de imágenes + reemplazo de imagen existente al subir una
  nueva foto.
- **Compresión de imágenes antes de subir a Cloudinary** (nuevo respecto a
  v1) para carga rápida en la UI.

### 5.4 Entradas manuales

- Para productos de proveedores distintos a Vida Digital/Sanjh, o para
  regularizar histórico (ver 5.2): formulario manual con búsqueda de
  producto, cantidad, bodega destino, fecha.
- Lógica de herencia de ubicación aplica igual que en sync automático.

### 5.5 Salidas (Bodega → Módulo)

- Selección de producto, cantidad, bodega origen, módulo destino.
- Login obligatorio, timestamp automático.
- Descuento atómico de stock en bodega origen, incremento en módulo destino
  (mismo patrón de CTE atómica con `FOR UPDATE` que funcionó en v1 — sin
  el bug de fallo silencioso de Drizzle + Neon HTTP driver).

### 5.6 Retornos (Módulo → Bodega)

- Operación inversa a salida: módulo origen, bodega destino, cantidad,
  usuario, timestamp.
- Misma lógica atómica que salidas.

### 5.7 Vistas de bodegas y módulos

- `/bodegas` y `/bodegas/[bodegaId]`: listado paginado de stock con
  búsqueda, filtro "solo con stock", paginación por cursor estable
  (usar `producto_id` como cursor, no timestamp — lección aprendida de v1).
- `/modulos` y `/modulos/[moduloId]`: listado de stock por módulo, edición
  con reconciliación de stock hacia bodega origen.

### 5.8 Historial de movimientos

- Por producto: timeline de entradas, salidas, retornos — todas las
  variantes desde el inicio, sin necesidad de agregar tipos después.

### 5.9 Usuarios y seguridad

- NextAuth v5, roles operador/admin.
- `activity_log` para cada entrada, salida, retorno, edición de datos
  críticos.

## 6. Explícitamente fuera del MVP

- Módulo OCR Kingnex (descartado completamente, no se retoma).
- Cualquier sync o lectura desde `arjun.inv_sdo` o WinFac Arjun directo.
- Integración automática con Sanjh para productos fuera del filtro de
  cliente Anil (2, 20, 218).
- Soporte para GL2 como bodega física independiente.
- Migración de datos históricos de la v1 (la v2 arranca con balances en
  cero; la mercadería físicamente existente se regulariza vía 5.2 + 5.4).

## 7. Integraciones externas conocidas

- **Neon Vida Digital** (`VIDADIGITAL_DATABASE_URL`, solo lectura) — fuente
  de compras y catálogo de productos Anil.
- **Cloudinary** — almacenamiento de imágenes de producto (mismo cloud name
  que v1 puede reutilizarse, o uno nuevo — decidir en primer slice).
- **Vercel** — deploy, proyecto nuevo `app-arjun-v2`.
- **Neon (propia)** — base de datos transaccional de la app, proyecto nuevo.
- **cron-job.org** (o Vercel Cron) — disparo del sync periódico.

## 8. Restricciones técnicas

- Next.js 15, React 19, TypeScript 5.9, Tailwind v4, Drizzle ORM.
- Debe correr en Vercel.
- Base de datos propia en Neon PostgreSQL, completamente separada de la v1.
- Toda mutación de stock usa CTE atómica con `FOR UPDATE` y aritmética
  server-side — patrón obligatorio dado el historial de fallos silenciosos
  de Drizzle + Neon HTTP driver en updates concurrentes.
- Todo el desarrollo sigue ciclos PBT-IA estrictos (ver
  `CONTEXT-CLAUDE-CHAT.md` y reglas del Director Técnico).

## 9. Escala esperada

Igual que v1: equipo reducido (pocos operadores + 1 admin), bajo volumen de
transacciones diarias, pero alta sensibilidad a errores de stock por ser
inventario físico real.

## 10. Estructura de carpetas propuesta

```
app-arjun-v2/
├── app/
│   ├── (dashboard)/
│   │   ├── productos/
│   │   ├── entradas/
│   │   ├── salidas/
│   │   ├── bodegas/
│   │   ├── modulos/
│   │   └── usuarios/
│   ├── api/
│   │   ├── sync/
│   │   │   └── compras-anil/        # reemplaza sync/winfac
│   │   ├── retornos/
│   │   ├── salidas/
│   │   ├── entradas/
│   │   └── productos/
│   │       └── buscar-historico/    # autocompletado 5.2
│   └── (auth)/
├── components/
│   ├── productos/
│   ├── entradas/
│   ├── salidas/
│   ├── modulos/
│   ├── bodegas/
│   └── shared/
├── db/
│   ├── schema.ts                    # DB propia (Neon nueva)
│   ├── vidadigital/                 # conexión solo lectura
│   │   ├── index.ts
│   │   └── queries.ts               # compras-anil, buscar-historico
│   └── migrations/
├── lib/
│   ├── actions.ts
│   ├── validations.ts
│   └── utils/
│       └── get-bodega-por-codigo-ingreso.ts  # GLP/GL1/GL2 → bodega
└── __tests__/
```

import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  timestamp,
  pgEnum,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

// ── Enums ────────────────────────────────────────────────────────────────
export const tipoMovimientoEnum = pgEnum("tipo_movimiento", [
  "entrada",
  "salida",
  "retorno",
]);

// ── Productos ────────────────────────────────────────────────────────────
export const productos = pgTable("productos", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 30 }).notNull().unique(),
  detalle: text("detalle"),
  codigoPersonal: varchar("codigo_personal", { length: 50 }),
  packing: integer("packing"),
  ubicacion: varchar("ubicacion", { length: 100 }),
  observaciones: text("observaciones"),
  imagenUrl: varchar("imagen_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Bodegas ──────────────────────────────────────────────────────────────
export const bodegas = pgTable("bodegas", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Módulos ──────────────────────────────────────────────────────────────
export const modulos = pgTable("modulos", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Stock ────────────────────────────────────────────────────────────────
export const stock = pgTable(
  "stock",
  {
    id: serial("id").primaryKey(),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productos.id),
    bodegaId: integer("bodega_id").references(() => bodegas.id),
    moduloId: integer("modulo_id").references(() => modulos.id),
    cantidad: integer("cantidad").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // ON CONFLICT en sync y salidas/retornos requiere estas constraints.
    unique("uq_stock_producto_bodega").on(t.productoId, t.bodegaId),
    unique("uq_stock_producto_modulo").on(t.productoId, t.moduloId),
  ]
);

// ── Movimientos ──────────────────────────────────────────────────────────
export const movimientos = pgTable(
  "movimientos",
  {
    id: serial("id").primaryKey(),
    folio: varchar("folio", { length: 50 }),
    productoId: integer("producto_id")
      .notNull()
      .references(() => productos.id),
    tipo: tipoMovimientoEnum("tipo").notNull(),
    cantidad: integer("cantidad").notNull(),
    bodegaOrigenId: integer("bodega_origen_id").references(() => bodegas.id),
    moduloDestinoId: integer("modulo_destino_id").references(() => modulos.id),
    usuarioId: integer("usuario_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // Idempotencia: mismo folio + producto no puede moverse dos veces.
    unique("uq_movimientos_folio_producto").on(t.folio, t.productoId),
  ]
);

// ── Activity Log ─────────────────────────────────────────────────────────
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").notNull(),
  accion: varchar("accion", { length: 100 }).notNull(),
  entidad: varchar("entidad", { length: 50 }).notNull(),
  entidadId: integer("entidad_id"),
  detalles: jsonb("detalles"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Sync Watermark ───────────────────────────────────────────────────────
export const syncWatermark = pgTable("sync_watermark", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: varchar("value", { length: 100 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── NextAuth ─────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: varchar("role", { length: 20 }).notNull().default("operador"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

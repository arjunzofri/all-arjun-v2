/** Fase B — inv-25: compras importadas por producto (ledger local). DB real TEST, solo auth mock. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { productos, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getComprasProducto } from "@/lib/inventario/consultas";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
const host = (u?: string) => new URL(u!).host;
const tag = `CMP${Date.now().toString(36)}`;
const flagPrevio = process.env.FEATURE_INVENTARIO_BODEGA;
let u1 = 0, prodMain = 0, prodMap = 0;
const ids: number[] = [];
const compra = (p: number, codigo: string | null, fecha: string, folio: string, cant = 1, precio?: string | null) =>
  db.execute(sql`INSERT INTO compras_importadas (folio, producto_id, bodega_codigo, cantidad, fecha_confirmacion, precio_unitario)
    VALUES (${folio}, ${p}, ${codigo}, ${cant}, ${fecha}::date, ${precio ?? null})`);
beforeAll(async () => {
  if (host(process.env.DATABASE_URL) === process.env.PROD_DATABASE_URL_HOST) throw new Error("DATABASE_URL apunta a producción: se aborta antes de SQL");
  const [u] = await db.insert(users).values({ username: `${tag}u1` }).returning({ id: users.id });
  u1 = u.id;
  for (const codigo of [`${tag}P1`, `${tag}P2`]) {
    const [p] = await db.insert(productos).values({ codigo, detalle: `fixture ${tag}` }).returning({ id: productos.id });
    ids.push(p.id);
  }
  [prodMain, prodMap] = ids;
  for (let i = 0; i < 12; i++) await compra(prodMain, "GLP", "2026-07-01", `${tag}M${i}`);
  for (let i = 0; i < 9; i++) await compra(prodMain, "GLP", "2026-06-30", `${tag}N${i}`);
  await compra(prodMain, "GL1", "2026-05-01", `${tag}LATE`); // confirmada tarde: id mayor, fecha menor
  for (const [c, pr] of [["GLP", "4.35"], ["GL1", null], ["GL2", "0"], ["GX", null], [null, null]] as const)
    await compra(prodMap, c, "2026-07-01", `${tag}X${c ?? "NULL"}`, 2, pr);
});
afterAll(async () => {
  try {
    await db.execute(sql`DELETE FROM compras_importadas WHERE folio LIKE ${`${tag}%`}`);
    if (ids.length) await db.execute(sql`DELETE FROM productos WHERE id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
    if (u1) await db.delete(users).where(eq(users.id, u1));
  } finally {
    if (flagPrevio === undefined) delete process.env.FEATURE_INVENTARIO_BODEGA;
    else process.env.FEATURE_INVENTARIO_BODEGA = flagPrevio;
  }
});
beforeEach(() => {
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
  vi.mocked(auth).mockResolvedValue({ user: { id: String(u1) } } as never);
});
it("operador: DTO sin precioUnitario ni rastro de costo; admin: 4.35, null y 0 se conservan", async () => {
  const op = await getComprasProducto({ productoId: prodMap });
  expect(op.items).toHaveLength(5);
  for (const i of op.items) expect("precioUnitario" in i).toBe(false);
  expect(JSON.stringify(op)).not.toMatch(/precio/i);
  vi.mocked(auth).mockResolvedValue({ user: { id: String(u1), role: "admin" } } as never);
  const ad = await getComprasProducto({ productoId: prodMap });
  const por = (f: string) => ad.items.find((i) => i.folio === `${tag}X${f}`)!.precioUnitario;
  expect([por("GLP"), por("GL1"), por("GL2"), por("GX"), por("NULL")]).toEqual([4.35, null, 0, null, null]);
});
it("bodega: GLP y GL2 → Bodega 1, GL1 → Bodega 2, GX crudo, null → null (UI «Sin bodega»)", async () => {
  const { items } = await getComprasProducto({ productoId: prodMap, limit: 100 });
  const por = (f: string) => items.find((i) => i.folio === `${tag}X${f}`)!.bodega;
  expect([por("GLP"), por("GL2"), por("GL1"), por("GX"), por("NULL")])
    .toEqual(["Bodega 1 Vida Digital", "Bodega 1 Vida Digital", "Bodega 2 Vida Digital", "GX", null]);
});
it("fecha DESC e id DESC; nota confirmada tarde cae por fecha; cursor compuesto pagina sin repetir ni omitir", async () => {
  const todo = await getComprasProducto({ productoId: prodMain, limit: 100 });
  expect(todo.items).toHaveLength(22);
  expect(todo.nextCursor).toBeNull();
  const fechas = todo.items.map((i) => i.fechaConfirmacion);
  expect(fechas).toEqual([...fechas].sort().reverse());
  expect(todo.items[0].folio).toBe(`${tag}M11`);
  expect(todo.items[todo.items.length - 1].folio).toBe(`${tag}LATE`);
  const vistos: number[] = [];
  let cursor: { fechaConfirmacion: string; id: number } | null = null;
  do {
    const p = await getComprasProducto({ productoId: prodMain, limit: 5, ...(cursor ? { cursor } : {}) });
    if (p.nextCursor) {
      const ultima = p.items[p.items.length - 1];
      expect(p.nextCursor).toEqual({ fechaConfirmacion: ultima.fechaConfirmacion, id: ultima.id });
    }
    vistos.push(...p.items.map((i) => i.id));
    cursor = p.nextCursor;
  } while (cursor);
  expect(vistos).toHaveLength(22);
  expect(new Set(vistos).size).toBe(22);
  expect(vistos).toEqual(todo.items.map((i) => i.id));
});
it("rol del input se rechaza; cursor inválido da mensaje fijo y sin SQL; sin sesión/flag off no consulta", async () => {
  const spy = vi.spyOn(db, "execute");
  try {
    const msg = "Parámetros de búsqueda inválidos.";
    for (const bad of [{ productoId: prodMap, role: "admin" }, { productoId: prodMap, esAdmin: true },
      { productoId: prodMap, cursor: { fechaConfirmacion: "01-07-2026", id: 1 } },
      { productoId: prodMap, cursor: { fechaConfirmacion: "2026-02-31", id: 1 } },
      { productoId: prodMap, cursor: { fechaConfirmacion: "2026-07-01", id: -1 } }, { productoId: 0 }])
      await expect(getComprasProducto(bad)).rejects.toThrow(msg);
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    await expect(getComprasProducto({ productoId: prodMap })).rejects.toThrow(/sesi/i);
    process.env.FEATURE_INVENTARIO_BODEGA = "false";
    try { await expect(getComprasProducto({ productoId: prodMap })).rejects.toThrow(/habilitad/i); }
    finally { process.env.FEATURE_INVENTARIO_BODEGA = "true"; }
    expect(spy).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});
it("fallo de DB: mensaje fijo sin texto del error; la acción solo lee y no toca Vida Digital", async () => {
  const spy = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("postgres://u:p@host/db"));
  try {
    const err = await getComprasProducto({ productoId: prodMap }).catch((e: unknown) => e);
    expect((err as Error).message).toBe("No se pudo cargar el historial de compras. Intente nuevamente.");
    expect((err as Error).message).not.toMatch(/postgres|http|host|u:p/i);
  } finally { spy.mockRestore(); }
  const src = readFileSync(resolve(__dirname, "../lib/inventario/consultas.ts"), "utf8");
  const accion = src.slice(src.indexOf("export async function getComprasProducto"), src.indexOf("export interface TotalesValorizacion"));
  expect(accion).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/i);
  expect(src).not.toMatch(/vidadigital/i);
});

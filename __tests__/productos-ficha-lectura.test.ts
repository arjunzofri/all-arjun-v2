/**
 * Fase B — INV-13.1: ficha de lectura nueva (rama primero).
 * DB TEST real, auth mock, getProducto espiado (real solo para OFF).
 * ROJO: page aún no tiene rama ON ni FichaProducto.
 */
import { readFileSync } from "node:fs"; import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { conteosInventario, productos, users } from "@/db/schema";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
const real = vi.hoisted(() => ({ getProducto: null as null | ((id: number) => Promise<unknown>) }));
const espia = vi.hoisted(() => ({ getProducto: vi.fn() }));
vi.mock("@/lib/actions/productos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/actions/productos")>();
  real.getProducto = actual.getProducto;
  return { ...actual, getProducto: espia.getProducto };
});
import ProductoDetallePage, { buildVolverHref, dynamic as pageDynamic } from "@/app/(dashboard)/productos/[id]/page";
const host = (u?: string) => new URL(u!).host; const tag = `FIC${Date.now().toString(36)}`; // código <= 30
const flagPrevio = process.env.FEATURE_INVENTARIO_BODEGA;
const FECHA = "2026-11-17T02:30:00Z"; // Chile: 16-11-2026 23:30
let u1 = 0, dual = 0, pend = 0, cero = 0;
const ids: number[] = [];
const insertar = (p: number, b: number, planta: string, pasillo: string, pos: string, cant: number) =>
  db.execute(sql`INSERT INTO conteos_inventario (producto_id, bodega, planta, pasillo, posicion, cantidad, usuario_id, idempotency_key, creado_en)
    VALUES (${p}, ${b}, ${planta}, ${pasillo}, ${pos}, ${cant}, ${u1}, ${`${tag}-${p}-${b}-${planta}-${pasillo}-${pos}`}, ${FECHA}::timestamptz)`);
const producto = async (codigo: string, extra: Partial<typeof productos.$inferInsert> = {}) => {
  const [p] = await db.insert(productos).values({ codigo, detalle: `detalle ${codigo}`, ...extra }).returning({ id: productos.id });
  ids.push(p.id);
  return p.id;
};
const render = (id: string | number, refQ?: string) =>
  ProductoDetallePage({ params: Promise.resolve({ id: String(id) }), searchParams: Promise.resolve(refQ === undefined ? {} : { refQ }) });
const html = async (id: string | number, refQ?: string) => renderToStaticMarkup(await render(id, refQ));
const digest = (e: unknown) => (e as { digest?: string }).digest;
beforeAll(async () => {
  if (host(process.env.DATABASE_URL) === process.env.PROD_DATABASE_URL_HOST) throw new Error("DATABASE_URL apunta a producción: se aborta antes de SQL");
  const ddl = readFileSync(resolve(__dirname, "../db/migrations/0001_inventario_conteos.sql"), "utf8");
  for (const st of ddl.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean)) await db.execute(sql.raw(st));
  [u1] = (await db.insert(users).values({ username: `${tag}u1` }).returning({ id: users.id })).map((u) => u.id);
  dual = await producto(`${tag}DUAL`, { codigoPersonal: `${tag}ALIAS`, packing: 13, observaciones: `${tag}OBS`, ubicacion: `${tag}SENTINELA` });
  await insertar(dual, 1, "", "A1", "M", 4);
  await insertar(dual, 2, "ARRIBA", "IZQUIERDA", "F", 3);
  pend = await producto(`${tag}PEND`); cero = await producto(`${tag}CERO`);
  await insertar(cero, 1, "", "A2", "F", 0);
});
afterAll(async () => {
  try {
    if (ids.length) { await db.delete(conteosInventario).where(inArray(conteosInventario.productoId, ids)); await db.delete(productos).where(inArray(productos.id, ids)); }
    if (u1) await db.delete(users).where(inArray(users.id, [u1]));
  } finally {
    if (flagPrevio === undefined) delete process.env.FEATURE_INVENTARIO_BODEGA;
    else process.env.FEATURE_INVENTARIO_BODEGA = flagPrevio;
  }
});
beforeEach(() => {
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
  vi.mocked(auth).mockResolvedValue({ user: { id: String(u1) } } as never);
  espia.getProducto.mockReset();
});
it("ON: ficha segura con alias, packing, observaciones, total y 2 bodegas con autor y fecha-hora Chile; sin legacy", async () => {
  const out = await html(dual);
  expect(espia.getProducto).not.toHaveBeenCalled();
  for (const txt of [`${tag}DUAL`, "detalle", `${tag}ALIAS`, "Packing", "13", `${tag}OBS`, "Total contado: 7",
    `${tag}u1`, "16-11-2026", "23:30", "B1 · A1 · Medio", "B2 · Arriba · Izquierda · Fondo", 'href="/inventario"'])
    expect(out).toContain(txt);
  expect(await html(dual, "ca ja")).toContain("/inventario?q=ca%20ja");
  expect(out).not.toMatch(/USD|precio|Historial de compras|M[oó]dulos|Pr[oó]ximamente|SENTINELA/i);
});

it("ON: pendiente (null) y contado 0 se distinguen", async () => {
  const p = await html(pend);
  expect(p).toMatch(/Sin contar/);
  expect(p).toMatch(/Sin posiciones contadas/);
  const c = await html(cero);
  expect(c).toMatch(/Total contado: 0/);
  expect(c).not.toMatch(/Sin contar|Sin posiciones contadas/);
});
it("ON: ID inválido no consulta; producto inexistente → notFound", async () => {
  const spy = vi.spyOn(db, "execute");
  try {
    for (const bad of ["abc", "0", "-1", "1.5", "2147483648"])
      expect(digest(await render(bad).catch((e) => e))).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(spy).not.toHaveBeenCalled();
    expect(espia.getProducto).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
  const borrado = await producto(`${tag}GONE`);
  await db.delete(productos).where(inArray(productos.id, [borrado]));
  expect(digest(await render(borrado).catch((e) => e))).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
});

it("OFF: página legacy intacta y usa getProducto real", async () => {
  process.env.FEATURE_INVENTARIO_BODEGA = "false";
  espia.getProducto.mockImplementation((id: number) => real.getProducto!(id));
  const out = await html(dual);
  expect(espia.getProducto).toHaveBeenCalledWith(dual);
  expect(out).toMatch(/Historial de compras/);
  expect(out).toMatch(/Editar producto/);
  expect(out).not.toMatch(/Sin posiciones contadas/);
});

it("compat: force-dynamic declarado y buildVolverHref conservado", () => {
  expect(pageDynamic).toBe("force-dynamic");
  expect(buildVolverHref("foo bar")).toBe("/productos?q=foo%20bar");
  expect(buildVolverHref(undefined)).toBe("/productos");
});
it("ON: fallo de DB resuelve a estado recuperable, sin error crudo", async () => {
  const spy = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("postgres://u:p@host/db"));
  try { const out = await html(dual); expect(out).toContain("No se pudo cargar el producto. Intente nuevamente."); expect(out).toContain('href="/inventario"'); expect(out).not.toMatch(/postgres|u:p|@host/); } finally { spy.mockRestore(); }
});

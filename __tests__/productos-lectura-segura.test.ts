/**
 * Fase B — INV-13.2: guard de lectura vieja + GET API DTO seguro.
 * DB TEST real, auth mock, sin mock de acciones.
 * ROJO: `getProducto` aún no corta con flag ON y el GET aún no bifurca al DTO.
 */
import { readFileSync } from "node:fs"; import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { conteosInventario, productos, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getProducto } from "@/lib/actions/productos";
import { GET } from "@/app/api/productos/[id]/route";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
const host = (u?: string) => new URL(u!).host;
const tag = `LEC${Date.now().toString(36)}`; // codigo varchar(30): tag corto
const flagPrevio = process.env.FEATURE_INVENTARIO_BODEGA;
const FECHA = "2026-11-17T02:30:00Z";
const SENTINELA = `${tag}-UBICACION-LEGACY`;
let u1 = 0, prod = 0, borrado = 0;
const ids: number[] = [];
const insertar = (p: number, b: number, planta: string, pasillo: string, pos: string, cant: number) =>
  db.execute(sql`INSERT INTO conteos_inventario (producto_id, bodega, planta, pasillo, posicion, cantidad, usuario_id, idempotency_key, creado_en)
    VALUES (${p}, ${b}, ${planta}, ${pasillo}, ${pos}, ${cant}, ${u1}, ${`${tag}-${p}-${b}-${planta}-${pasillo}-${pos}`}, ${FECHA}::timestamptz)`);
const producto = async (codigo: string, extra: Partial<typeof productos.$inferInsert> = {}) => {
  const [p] = await db.insert(productos).values({ codigo, detalle: `detalle ${codigo}`, ...extra }).returning({ id: productos.id });
  ids.push(p.id);
  return p.id;
};
const get = (id: string) => GET(new Request(`https://app-arjun.local/api/productos/${id}`), { params: Promise.resolve({ id }) });
const statusDe = async (id: string) => { try { return (await get(id)).status; } catch { return "throw"; } };
beforeAll(async () => {
  if (host(process.env.DATABASE_URL) === process.env.PROD_DATABASE_URL_HOST) throw new Error("DATABASE_URL apunta a producción: se aborta antes de SQL");
  const ddl = readFileSync(resolve(__dirname, "../db/migrations/0001_inventario_conteos.sql"), "utf8");
  for (const st of ddl.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean)) await db.execute(sql.raw(st));
  [u1] = (await db.insert(users).values({ username: `${tag}u1` }).returning({ id: users.id })).map((u) => u.id);
  prod = await producto(`${tag}DUAL`, { codigoPersonal: `${tag}ALIAS`, packing: 13, observaciones: `${tag}OBS`, ubicacion: SENTINELA });
  await insertar(prod, 1, "", "A1", "M", 4);
  await insertar(prod, 2, "ARRIBA", "IZQUIERDA", "F", 3);
  borrado = await producto(`${tag}GONE`);
});
afterAll(async () => {
  try {
    if (ids.length) await db.delete(conteosInventario).where(inArray(conteosInventario.productoId, ids));
    if (ids.length) await db.delete(productos).where(inArray(productos.id, ids));
    if (u1) await db.delete(users).where(inArray(users.id, [u1]));
  } finally {
    if (flagPrevio === undefined) delete process.env.FEATURE_INVENTARIO_BODEGA;
    else process.env.FEATURE_INVENTARIO_BODEGA = flagPrevio;
  }
});
beforeEach(() => {
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
  vi.mocked(auth).mockResolvedValue({ user: { id: String(u1) } } as never);
});
it("ON: getProducto rechaza antes de cualquier SQL; OFF: devuelve el legacy real", async () => {
  const sel = vi.spyOn(db, "select"), exe = vi.spyOn(db, "execute");
  try {
    process.env.FEATURE_INVENTARIO_BODEGA = "true";
    await expect(getProducto(prod)).rejects.toThrow(/modo inventario nuevo|deshabilitadas/i);
    expect(sel).not.toHaveBeenCalled(); expect(exe).not.toHaveBeenCalled();
  } finally { sel.mockRestore(); exe.mockRestore(); }
  process.env.FEATURE_INVENTARIO_BODEGA = "false";
  try {
    await expect(getProducto(prod)).resolves.toMatchObject({ id: prod, codigo: `${tag}DUAL`, compras: [], bodegas: [], modulos: [] });
  } finally { process.env.FEATURE_INVENTARIO_BODEGA = "true"; }
});
it("ON: GET 200 con claves exactas del DTO, posiciones con autor/fecha y sin campos privados", async () => {
  const res = await get(String(prod));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Object.keys(body).sort()).toEqual(["codigo", "codigoPersonal", "detalle", "id", "imagenUrl", "observaciones", "packing", "posiciones", "stockContado"]);
  expect([body.id, body.stockContado, body.posiciones.length]).toEqual([prod, 7, 2]);
  const p = body.posiciones[0];
  expect(Object.keys(p).sort()).toEqual(["bodega", "cantidad", "creadoEn", "id", "pasillo", "planta", "posicion", "usuario", "usuarioId"]);
  expect([p.usuario, p.usuarioId, p.creadoEn]).toEqual([`${tag}u1`, u1, "2026-11-17T02:30:00.000Z"]);
  const raw = JSON.stringify(body);
  for (const k of ["compras", "precioUnitario", "bodegas", "modulos", "ubicacion", "nonce", SENTINELA]) expect(raw).not.toContain(k);
});
it("ON: ID inválido → 400 sin SQL; producto propio borrado → 404", async () => {
  const sel = vi.spyOn(db, "select"), exe = vi.spyOn(db, "execute");
  try {
    for (const bad of ["abc", "0", "-1", "1.5", "2147483648"]) expect(await statusDe(bad)).toBe(400);
    expect(sel).not.toHaveBeenCalled(); expect(exe).not.toHaveBeenCalled();
  } finally { sel.mockRestore(); exe.mockRestore(); }
  await db.delete(productos).where(inArray(productos.id, [borrado]));
  expect(await statusDe(String(borrado))).toBe(404);
});
it("ON: GET sin sesión → 401 antes de cualquier SQL", async () => {
  vi.mocked(auth).mockResolvedValueOnce(null as never);
  const sel = vi.spyOn(db, "select"), exe = vi.spyOn(db, "execute");
  try {
    expect(await statusDe(String(prod))).toBe(401);
    expect(sel).not.toHaveBeenCalled(); expect(exe).not.toHaveBeenCalled();
  } finally { sel.mockRestore(); exe.mockRestore(); }
});
it("OFF: GET conserva legacy con compras/bodegas/módulos/ubicación y sin posiciones", async () => {
  process.env.FEATURE_INVENTARIO_BODEGA = "false";
  try {
    const res = await get(String(prod));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect([body.id, body.codigo, body.ubicacion]).toEqual([prod, `${tag}DUAL`, SENTINELA]);
    for (const k of ["compras", "bodegas", "modulos"]) expect(body).toHaveProperty(k);
    expect(body).not.toHaveProperty("posiciones");
  } finally { process.env.FEATURE_INVENTARIO_BODEGA = "true"; }
});
it("ON: fallo de consulta → 500 con mensaje español fijo, sin SQL/URL ni datos", async () => {
  const exe = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("postgres://u:p@host/db SELECT * FROM productos"));
  try {
    const res = await get(String(prod));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/no se pudo|intente nuevamente/i);
    expect(JSON.stringify(body)).not.toMatch(/postgres|http|host|u:p|SELECT/i);
    for (const k of ["compras", "posiciones", "codigo"]) expect(body).not.toHaveProperty(k);
  } finally { exe.mockRestore(); }
});

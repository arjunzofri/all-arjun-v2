/** Fase B — inv-audit-05-A: listarInventario(). DB real rama TEST, solo auth mock. ROJO: módulo de producto ausente. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { conteosInventario, productos, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getFichaInventario, getHistorialConteos, listarInventario,
  type FilaInventario, type PosicionContada } from "@/lib/inventario/consultas";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
const host = (u?: string) => new URL(u!).host;
const tag = `INVQ${Date.now().toString(36)}`; // codigo varchar(30): tag corto
const flagPrevio = process.env.FEATURE_INVENTARIO_BODEGA;
let u1 = 0, u2 = 0, prodA = 0, prodCero = 0, prodPend = 0, b1 = 0;
const ids: number[] = [];
const insertar = (p: number, b: number, planta: string, pasillo: string, pos: string, cant: number, u: number, fecha: string) =>
  db.execute(sql`INSERT INTO conteos_inventario (producto_id, bodega, planta, pasillo, posicion, cantidad, usuario_id, idempotency_key, creado_en)
    VALUES (${p}, ${b}, ${planta}, ${pasillo}, ${pos}, ${cant}, ${u}, ${`${tag}-${p}-${b}-${planta}-${pasillo}-${pos}-${fecha}`}, ${fecha}::timestamptz)`);
const producto = async (codigo: string, extra: Partial<typeof productos.$inferInsert> = {}) => {
  const [p] = await db.insert(productos).values({ codigo, detalle: `fixture ${tag}`, ...extra }).returning({ id: productos.id });
  ids.push(p.id);
  return p.id;
};
const items = async (q: string) => (await listarInventario({ q, limit: 50 })).items;
beforeAll(async () => {
  if (host(process.env.DATABASE_URL) === process.env.PROD_DATABASE_URL_HOST) throw new Error("DATABASE_URL apunta a producción: se aborta antes de SQL");
  const ddl = readFileSync(resolve(__dirname, "../db/migrations/0001_inventario_conteos.sql"), "utf8");
  for (const st of ddl.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean)) await db.execute(sql.raw(st));
  await db.execute(sql`INSERT INTO bodegas (nombre) VALUES ('Bodega 1 Vida Digital'), ('Bodega 2 Vida Digital') ON CONFLICT (nombre) DO NOTHING`);
  const bs = (await db.execute(sql`SELECT nombre, id FROM bodegas WHERE nombre IN ('Bodega 1 Vida Digital', 'Bodega 2 Vida Digital')`)) as unknown as { rows: { id: number | string; nombre: string }[] };
  b1 = Number(bs.rows.find((b) => b.nombre === "Bodega 1 Vida Digital")!.id);
  const us = await db.insert(users).values([{ username: `${tag}u1` }, { username: `${tag}u2` }]).returning({ id: users.id });
  u1 = us[0].id; u2 = us[1].id;
  prodA = await producto(`${tag}GRP`);
  await insertar(prodA, 1, "", "A1", "M", 99, u2, "2026-01-01T00:00:00Z");
  for (const [pa, po] of [["A1", "F"], ["A2", "M"], ["A3", "P"], ["A4", "F"]]) await insertar(prodA, 1, "", pa, po, 1, u2, "2026-11-02T10:00:00Z");
  await insertar(prodA, 1, "", "A1", "M", 1, u1, "2026-11-01T10:00:00Z");
  for (const [pl, pa, po] of [["ARRIBA", "IZQUIERDA", "M"], ["ABAJO", "DERECHA", "F"], ["ARRIBA", "DERECHA", "P"]]) await insertar(prodA, 2, pl, pa, po, 1, u1, "2026-11-03T10:00:00Z");
  prodPend = await producto(`${tag}PEND`);
  prodCero = await producto(`${tag}CERO`);
});
afterAll(async () => {
  try {
    await db.execute(sql`DELETE FROM compras_importadas WHERE folio LIKE ${`${tag}%`}`);
    if (ids.length) await db.delete(conteosInventario).where(inArray(conteosInventario.productoId, ids));
    if (ids.length) await db.delete(productos).where(inArray(productos.id, ids));
    if (u1) await db.delete(users).where(inArray(users.id, [u1, u2]));
  } finally {
    if (flagPrevio === undefined) delete process.env.FEATURE_INVENTARIO_BODEGA;
    else process.env.FEATURE_INVENTARIO_BODEGA = flagPrevio;
  }
});
beforeEach(() => {
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
  vi.mocked(auth).mockResolvedValue({ user: { id: String(u1) } } as never);
});
it("agrupa vigentes en array plano 5 B1 + 3 B2, descarta antecedente 99 y preserva fecha/autor", async () => {
  const [item] = await items(`${tag}GRP`);
  const fila: FilaInventario = item;
  const b1 = fila.posiciones.filter((p) => p.bodega === 1), b2 = fila.posiciones.filter((p) => p.bodega === 2);
  expect([b1.length, b2.length, fila.stockContado]).toEqual([5, 3, 8]);
  const a1m: PosicionContada = b1.find((p) => p.pasillo === "A1" && p.posicion === "M")!;
  expect([a1m.cantidad, a1m.usuarioId, a1m.usuario]).toEqual([1, u1, `${tag}u1`]);
  expect(Number.isSafeInteger(a1m.id)).toBe(true);
  expect(a1m.creadoEn).toBe("2026-11-01T10:00:00.000Z");
  expect(new Set(b1.map((p) => p.creadoEn)).size).toBe(2);
  expect(Object.keys(fila).sort()).toEqual(["codigo", "codigoPersonal", "detalle", "id", "imagenUrl", "observaciones", "packing", "posiciones", "stockContado"]);
  expect(Object.keys(a1m).sort()).toEqual(["bodega", "cantidad", "creadoEn", "id", "pasillo", "planta", "posicion", "usuario", "usuarioId"]);
  expect(JSON.stringify(fila)).not.toMatch(/precio|nonce|idempotency/i);
});
it("cantidad 0 no es pendiente; sin posiciones devuelve [] y stockContado null", async () => {
  await insertar(prodCero, 1, "", "A1", "M", 0, u1, "2026-11-04T10:00:00Z");
  const [cero] = await items(`${tag}CERO`);
  const [pend] = await items(`${tag}PEND`);
  expect([cero.stockContado, cero.posiciones.map((p) => p.cantidad)]).toEqual([0, [0]]);
  expect([pend.stockContado, pend.posiciones]).toEqual([null, []]);
});
it("pagina por id DESC con limit de productos (no de filas), sin saltos ni repetidos", async () => {
  const pgs = await Promise.all([1, 2, 3, 4, 5].map((i) => producto(`${tag}PG${i}`)));
  for (const [pa, po] of [["A1", "M"], ["A2", "M"], ["A3", "M"]]) await insertar(Math.max(...pgs), 1, "", pa, po, 1, u1, "2026-11-05T10:00:00Z");
  const p1 = await listarInventario({ q: `${tag}PG`, limit: 2 });
  const p2 = await listarInventario({ q: `${tag}PG`, limit: 2, cursor: p1.nextCursor! });
  const p3 = await listarInventario({ q: `${tag}PG`, limit: 2, cursor: p2.nextCursor! });
  const vistos = [...p1.items, ...p2.items, ...p3.items].map((i) => i.id);
  expect([p1.items.length, p2.items.length, p3.items.length, p3.nextCursor]).toEqual([2, 2, 1, null]);
  expect(p1.nextCursor).toBe(p1.items[1].id);
  expect(new Set(vistos).size).toBe(5);
  expect(vistos).toEqual([...vistos].sort((a, b) => b - a));
});
it("busca codigo/alias/descripcion case-insensitive y escapa % y _ del usuario", async () => {
  await producto(`${tag}ALI`, { codigoPersonal: `${tag}ALIAS`, detalle: `${tag}DESC` });
  await producto(`${tag}%Z`);
  await producto(`${tag}AZ`);
  await producto(`${tag}_Z`);
  await producto(`${tag}ZZ`);
  expect((await items(`${tag}ALIAS`)).map((i) => i.codigo)).toEqual([`${tag}ALI`]);
  expect((await items(`${tag}DESC`)).map((i) => i.codigo)).toEqual([`${tag}ALI`]);
  expect((await items(tag.toLowerCase() + "GRP")).map((i) => i.codigo)).toEqual([`${tag}GRP`]);
  expect((await items(`${tag}%`)).map((i) => i.codigo)).toEqual([`${tag}%Z`]);
  expect((await items(`${tag}_`)).map((i) => i.codigo)).toEqual([`${tag}_Z`]);
});
it("auth inválida, flag apagado o params fuera de Zod rechazan antes de cualquier SQL", async () => {
  const spy = vi.spyOn(db, "execute");
  try {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    await expect(listarInventario({})).rejects.toThrow(/sesi/i);
    process.env.FEATURE_INVENTARIO_BODEGA = "false";
    await expect(listarInventario({})).rejects.toThrow(/habilitad/i);
    process.env.FEATURE_INVENTARIO_BODEGA = "true";
    const msg = "Parámetros de búsqueda inválidos.";
    await expect(listarInventario({ limit: 0 })).rejects.toThrow(msg);
    await expect(listarInventario({ cursor: -1 })).rejects.toThrow(msg);
    await expect(listarInventario({ cursor: 2147483648 })).rejects.toThrow(msg);
    await expect(listarInventario({ q: "x", extra: 1 })).rejects.toThrow(msg);
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});
it("oculta SQL/URL y devuelve mensaje fijo si falla la base", async () => {
  const spy = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("postgres://u:p@host/db"));
  try { const err = await listarInventario({}).catch((e: unknown) => e);
    expect((err as Error).message).toBe("No se pudo obtener el inventario. Intente nuevamente.");
    expect((err as Error).message).not.toMatch(/postgres|http|host|u:p/i);
  } finally { spy.mockRestore(); }
});
it("getFichaInventario resuelve por ID exacto y devuelve null si el producto no existe", async () => {
  const ficha = await getFichaInventario(prodA);
  expect(ficha?.id).toBe(prodA);
  expect(ficha?.posiciones.length).toBe(8);
  expect(ficha?.stockContado).toBe(8);
  expect(Object.keys(ficha!).sort()).toEqual(["codigo", "codigoPersonal", "detalle", "id", "imagenUrl", "observaciones", "packing", "posiciones", "stockContado"]);
  expect(JSON.stringify(ficha)).not.toMatch(/precio|nonce|idempotency/i);
  await expect(getFichaInventario(prodPend)).resolves.toMatchObject({ id: prodPend, posiciones: [], stockContado: null });
  const borrado = await producto(`${tag}GONE`);
  await db.delete(productos).where(inArray(productos.id, [borrado]));
  await expect(getFichaInventario(borrado)).resolves.toBeNull();
});
it("getFichaInventario rechaza id inválido, sin sesión o flag off antes de cualquier SQL", async () => {
  const spy = vi.spyOn(db, "execute");
  try {
    for (const id of [0, -1, 2147483648, "5", null, undefined]) await expect(getFichaInventario(id)).rejects.toThrow("Parámetros de búsqueda inválidos.");
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    await expect(getFichaInventario(prodA)).rejects.toThrow(/sesi/i);
    process.env.FEATURE_INVENTARIO_BODEGA = "false";
    try { await expect(getFichaInventario(prodA)).rejects.toThrow(/habilitad/i); }
    finally { process.env.FEATURE_INVENTARIO_BODEGA = "true"; }
    expect(spy).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});
it("getHistorialConteos conserva las 9 versiones con autor/fecha y pagina 3+3+3 por id DESC", async () => {
  const todo = await getHistorialConteos({ productoId: prodA, limit: 100 });
  expect(todo.items.length).toBe(9);
  expect(todo.nextCursor).toBeNull();
  const idsDesc = todo.items.map((i) => i.id).sort((a, b) => b - a);
  expect(todo.items.map((i) => i.id)).toEqual(idsDesc);
  const viejo = todo.items.find((i) => i.cantidad === 99)!;
  expect([viejo.usuarioId, viejo.usuario, viejo.creadoEn]).toEqual([u2, `${tag}u2`, "2026-01-01T00:00:00.000Z"]);
  expect(todo.items.filter((i) => i.cantidad === 1)).toHaveLength(8);
  expect(Object.keys(viejo).sort()).toEqual(["bodega", "cantidad", "creadoEn", "id", "pasillo", "planta", "posicion", "usuario", "usuarioId"]);
  expect(JSON.stringify(todo)).not.toMatch(/precio|nonce|idempotency/i);
  const vistos: number[] = [];
  let cursor: number | null = null;
  for (let i = 0; i < 3; i++) {
    const p = await getHistorialConteos({ productoId: prodA, limit: 3, ...(cursor ? { cursor } : {}) });
    vistos.push(...p.items.map((x) => x.id));
    cursor = p.nextCursor;
  }
  expect([vistos.length, cursor]).toEqual([9, null]);
  expect(new Set(vistos).size).toBe(9);
  expect(vistos).toEqual(todo.items.map((i) => i.id));
});
const compra = (p: number, codigo: string | null, fecha: string, folio: string) =>
  db.execute(sql`INSERT INTO compras_importadas (folio, producto_id, bodega_codigo, cantidad, fecha_confirmacion) VALUES (${folio}, ${p}, ${codigo}, 1, ${fecha}::date)`);
const conFlag = async <T>(fn: () => Promise<T>): Promise<T> => {
  process.env.FEATURE_ASIGNACION_BODEGA_COMPRA = "true";
  try { return await fn(); } finally { delete process.env.FEATURE_ASIGNACION_BODEGA_COMPRA; }
};
it("asignacion OFF: ficha sin sugerenciaBodega y sin SQL extra", async () => {
  process.env.FEATURE_ASIGNACION_BODEGA_COMPRA = "false";
  const spy = vi.spyOn(db, "execute");
  try {
    const ficha = await getFichaInventario(prodA);
    expect(ficha).not.toHaveProperty("sugerenciaBodega");
    expect(Object.keys(ficha!).sort()).toEqual(["codigo", "codigoPersonal", "detalle", "id", "imagenUrl", "observaciones", "packing", "posiciones", "stockContado"]);
    expect(spy).toHaveBeenCalledTimes(1);
  } finally { spy.mockRestore(); delete process.env.FEATURE_ASIGNACION_BODEGA_COMPRA; }
});
it("asignacion ON: gana la compra más reciente (GL1 vieja, GLP nueva → bodega 1)", async () => {
  const p = await producto(`${tag}SUG1`);
  await compra(p, "GL1", "2026-11-01", `${tag}S1`); await compra(p, "GLP", "2026-11-15", `${tag}S2`);
  await conFlag(async () => expect((await getFichaInventario(p))!.sugerenciaBodega)
    .toEqual({ bodega: 1, bodegaId: b1, codigoIngreso: "GLP", administrativa: false }));
});
it("asignacion ON: última fila GLX con GLP anterior → null (no retrocede)", async () => {
  const p = await producto(`${tag}SUG2`);
  await compra(p, "GLP", "2026-11-01", `${tag}S3`); await compra(p, "GLX", "2026-11-15", `${tag}S4`);
  await conFlag(async () => expect((await getFichaInventario(p))!.sugerenciaBodega).toBeNull());
});
it("asignacion ON: producto sin compras → null", async () => {
  await conFlag(async () => expect((await getFichaInventario(prodPend))!.sugerenciaBodega).toBeNull());
});
it("asignacion ON: GL2 → bodega 1 administrativa y sin datos monetarios", async () => {
  const p = await producto(`${tag}SUG3`);
  await compra(p, "GL2", "2026-11-15", `${tag}S5`);
  await conFlag(async () => {
    const s = (await getFichaInventario(p))!.sugerenciaBodega;
    expect(s).toEqual({ bodega: 1, bodegaId: b1, codigoIngreso: "GL2", administrativa: true });
    expect(JSON.stringify(s)).not.toMatch(/precio|valor/i);
  });
});
it("getHistorialConteos valida params y sin sesión antes de SQL, oculta fallos y producto sin conteos da []", async () => {
  await expect(getHistorialConteos({ productoId: prodPend })).resolves.toEqual({ items: [], nextCursor: null });
  const spy = vi.spyOn(db, "execute");
  try {
    for (const bad of [{}, { productoId: 0 }, { productoId: 2147483648 }, { productoId: prodA, limit: 0 }, { productoId: prodA, cursor: -1 }, { productoId: prodA, cursor: Number.MAX_SAFE_INTEGER + 1 }])
      await expect(getHistorialConteos(bad)).rejects.toThrow(/parámetros/i);
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    await expect(getHistorialConteos({ productoId: prodA })).rejects.toThrow(/sesi/i);
    process.env.FEATURE_INVENTARIO_BODEGA = "false";
    try { await expect(getHistorialConteos({ productoId: prodA })).rejects.toThrow(/habilitad/i); }
    finally { process.env.FEATURE_INVENTARIO_BODEGA = "true"; }
    expect(spy).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
  const spySql = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("postgres://u:p@host/db"));
  try {
    const err = await getHistorialConteos({ productoId: prodA }).catch((e: unknown) => e);
    expect((err as Error).message).toBe("No se pudo obtener el historial. Intente nuevamente.");
    expect((err as Error).message).not.toMatch(/postgres|http|host|u:p/i);
  } finally { spySql.mockRestore(); }
});

/** Fase B inv-24b: consultas server admin de valorización. DB TEST, fixtures propios. */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db"; import { conteosInventario, productos, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getValorizacionLista, getValorizacionProducto } from "@/lib/inventario/consultas";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
const tag = `INVZ${Date.now().toString(36)}`, flagPrevio = process.env.FEATURE_INVENTARIO_BODEGA;
let u = 0, key = 0;
const ids: number[] = [];
const producto = async (codigo: string) => {
  const [p] = await db.insert(productos).values({ codigo, detalle: `fixture ${tag}` }).returning({ id: productos.id });
  ids.push(p.id);
  return p.id;
};
const conteo = (p: number, cant: number, fecha: string, bodega = 1, pos = "M") =>
  db.execute(sql`INSERT INTO conteos_inventario (producto_id, bodega, planta, pasillo, posicion, cantidad, usuario_id, idempotency_key, creado_en)
    VALUES (${p}, ${bodega}, '', 'A1', ${pos}, ${cant}, ${u}, ${`${tag}-${key++}`}, ${fecha}::timestamptz)`);
const compra = (p: number, folio: string, fecha: string, cant: number, precio: number | null) =>
  db.execute(sql`INSERT INTO compras_importadas (folio, producto_id, bodega_codigo, item, cantidad, precio_unitario, fecha_confirmacion)
    VALUES (${folio}, ${p}, 'GLP', 1, ${cant}, ${precio}, ${fecha}::date)`);
const comoAdmin = (rol = "admin") => vi.mocked(auth).mockResolvedValue({ user: { id: String(u), role: rol } } as never);
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).host === process.env.PROD_DATABASE_URL_HOST) throw new Error("DATABASE_URL apunta a producción");
  u = (await db.insert(users).values({ username: `${tag}u` }).returning({ id: users.id }))[0].id;
});
afterAll(async () => {
  try {
    await db.execute(sql`DELETE FROM compras_importadas WHERE folio LIKE ${`${tag}%`}`);
    if (ids.length) { await db.execute(sql`DELETE FROM stock WHERE producto_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`); await db.delete(conteosInventario).where(inArray(conteosInventario.productoId, ids)); }
    if (ids.length) await db.delete(productos).where(inArray(productos.id, ids));
    if (u) await db.delete(users).where(inArray(users.id, [u]));
  } finally {
    if (flagPrevio === undefined) delete process.env.FEATURE_INVENTARIO_BODEGA;
    else process.env.FEATURE_INVENTARIO_BODEGA = flagPrevio;
  }
});
beforeEach(() => { process.env.FEATURE_INVENTARIO_BODEGA = "true"; comoAdmin(); });
it("1. operador rechaza antes de cualquier SQL", async () => {
  const spy = vi.spyOn(db, "execute"); comoAdmin("operador");
  try {
    await expect(getValorizacionProducto(1)).rejects.toThrow(/administrador/i);
    await expect(getValorizacionLista({ q: tag })).rejects.toThrow(/administrador/i);
    expect(spy).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); comoAdmin(); }
});
it("2. admin recibe costos correctos (más reciente primero)", async () => {
  const p = await producto(`${tag}OK`);
  await conteo(p, 15, "2026-06-10T15:00:00Z");
  await compra(p, `${tag}OA`, "2026-06-01", 10, 2); await compra(p, `${tag}OB`, "2026-06-02", 10, 5);
  const v = await getValorizacionProducto(p);
  expect(v && [v.stock, v.valorTotal, v.cantidadSinCosto, v.costoPromedio]).toEqual([15, 60, 0, 4]);
  expect(v!.partidas.map((x) => [x.folio, x.cantidadSaldo, x.valor])).toEqual([[`${tag}OB`, 10, 50], [`${tag}OA`, 5, 10]]);
});
it("3. exactamente 3 ejecuciones SQL para 1 o N productos", async () => {
  const p = await producto(`${tag}N1`);
  await conteo(p, 1, "2026-06-10T15:00:00Z");
  const spy = vi.spyOn(db, "execute");
  try {
    await getValorizacionProducto(p);
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockClear();
    await getValorizacionLista({ q: tag });
    expect(spy).toHaveBeenCalledTimes(3);
  } finally { spy.mockRestore(); }
});
it("4. frontera Chile: 02:00Z pertenece al día anterior", async () => {
  const p = await producto(`${tag}CL`);
  await conteo(p, 10, "2026-06-15T02:00:00Z");
  await compra(p, `${tag}CA`, "2026-06-14", 10, 2); await compra(p, `${tag}CB`, "2026-06-15", 10, 5);
  const v = await getValorizacionProducto(p);
  expect([v!.fechaConteoMax, v!.valorTotal, v!.costoPromedio, v!.partidas.length]).toEqual(["2026-06-14", 20, 2, 1]);
});
it("5. stock legacy/módulos no cuenta y productos sin conteo no se valorizan", async () => {
  const p = await producto(`${tag}LEG`);
  await db.execute(sql`INSERT INTO stock (producto_id, cantidad) VALUES (${p}, 999)`);
  await expect(getValorizacionProducto(p)).resolves.toBeNull();
  const l = await getValorizacionLista({ q: `${tag}LEG` });
  expect([l.porProducto.length, l.totales.productosSinContar, l.totales.valorTotal]).toEqual([0, 1, 0]);
});
it("6. precio string→Number y null preservado", async () => {
  const p = await producto(`${tag}NUM`);
  await conteo(p, 10, "2026-06-10T15:00:00Z");
  await compra(p, `${tag}NP`, "2026-06-01", 5, 2.5); await compra(p, `${tag}NN`, "2026-06-02", 5, null);
  const v = await getValorizacionProducto(p);
  const con = v!.partidas.find((x) => x.folio === `${tag}NP`)!, sin = v!.partidas.find((x) => x.folio === `${tag}NN`)!;
  expect([typeof con.costoUnitario, con.costoUnitario, con.valor]).toEqual(["number", 2.5, 12.5]);
  expect([sin.costoUnitario, sin.valor, v!.cantidadSinCosto, v!.incompleto]).toEqual([null, null, 5, true]);
});
it("7. total del filtro abarca todas las páginas, no solo 20", async () => {
  const [a, b] = await Promise.all(Array.from({ length: 21 }, (_, i) => producto(`${tag}PAG${i}`)));
  for (const [p, fecha, precio] of [[a, "2026-06-01", 2], [b, "2026-06-02", 3]] as const) {
    await conteo(p, 10, "2026-06-10T15:00:00Z"); await compra(p, `${tag}P${p}`, fecha, 10, precio);
  }
  const l = await getValorizacionLista({ q: `${tag}PAG` });
  expect([l.porProducto.length, l.totales.productosConConteo, l.totales.productosSinContar, l.totales.valorTotal]).toEqual([2, 2, 19, 50]);
});
it("8. DTO serializable sin Map/Date; error con mensaje fijo", async () => {
  const l = await getValorizacionLista({ q: tag });
  expect(JSON.parse(JSON.stringify(l))).toEqual(l);
  const sinMapa = (v: unknown): boolean => typeof v !== "object" || v === null || (!(v instanceof Map) && !(v instanceof Date) && Object.values(v).every(sinMapa));
  expect(sinMapa(l)).toBe(true);
  const spy = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("postgres://u:p@host/db"));
  try { await expect(getValorizacionLista({ q: tag })).rejects.toThrow("No se pudo cargar la valorización. Intente nuevamente."); }
  finally { spy.mockRestore(); }
  await expect(getValorizacionProducto("x")).rejects.toThrow("Parámetros de búsqueda inválidos.");
});
it("9. producto sin conteos ausente de porProducto", async () => {
  const p = await producto(`${tag}PEND`), l = await getValorizacionLista({ q: `${tag}PEND` });
  expect(l.porProducto.map((x) => x.productoId)).not.toContain(p);
});
it("10. compra con cantidad negativa aísla solo ese producto y cuenta productosConError", async () => {
  const malo = await producto(`${tag}ZMAL`), bueno = await producto(`${tag}ZBUE`);
  await compra(malo, `${tag}ZMAL1`, "2026-06-01", -5, 2); await conteo(malo, 10, "2026-06-10T15:00:00Z");
  await compra(bueno, `${tag}ZBUE1`, "2026-06-01", 10, 3); await conteo(bueno, 10, "2026-06-10T15:00:00Z");
  const l = await getValorizacionLista({ q: `${tag}Z` });
  expect(l.porProducto.map((x) => x.productoId)).toEqual([bueno]);
  expect([l.totales.productosConError, l.totales.productosSinContar, l.totales.valorTotal]).toEqual([1, 0, 30]);
  await expect(getValorizacionProducto(malo)).rejects.toThrow("No se pudo cargar la valorización. Intente nuevamente.");
  expect((await getValorizacionProducto(bueno))!.valorTotal).toBe(30);
});

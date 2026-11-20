/** Fase B — INV-19.1: editor de datos en ficha ON. DB TEST real, auth mock.
 *  ROJO: EditorFichaProducto no existe y FichaProducto aún no lo renderiza. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { productos, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { updateProducto } from "@/lib/actions/productos";
import { FichaProducto } from "@/app/(dashboard)/productos/[id]/FichaProducto";
import { construirPayload, crearGuardar } from "@/components/inventario/EditorFichaProducto";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) };
});

const tag = `EDF${Date.now().toString(36)}`;
const flagPrevio = process.env.FEATURE_INVENTARIO_BODEGA;
const campos = { codigoPersonal: `  ${tag}A2 `, packing: " 18 ", observaciones: ` ${tag}O2 ` };
const vacio = { codigoPersonal: "", packing: "", observaciones: "" };
const fila = { id: 1, codigo: `${tag}COD`, detalle: `${tag}DET`, codigoPersonal: `${tag}ALIAS`, packing: 12,
  observaciones: `${tag}OBS`, imagenUrl: null, posiciones: [], stockContado: null };
let uid = 0, prod = 0;

beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).host === process.env.PROD_DATABASE_URL_HOST) throw new Error("DATABASE_URL apunta a producción: se aborta antes de SQL");
  [uid] = (await db.insert(users).values({ username: `${tag}U` }).returning({ id: users.id })).map((u) => u.id);
  [prod] = (await db.insert(productos).values({ codigo: `${tag}P`, codigoPersonal: `${tag}ALIAS`, packing: 12,
    ubicacion: `${tag}UBI`, observaciones: `${tag}OBS` }).returning({ id: productos.id })).map((p) => p.id);
});
beforeEach(async () => {
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
  vi.mocked(auth).mockResolvedValue({ user: { id: String(uid) } } as never);
});
afterAll(async () => {
  try {
    if (prod) await db.delete(productos).where(inArray(productos.id, [prod]));
    if (uid) await db.delete(users).where(inArray(users.id, [uid]));
  } finally {
    if (flagPrevio === undefined) delete process.env.FEATURE_INVENTARIO_BODEGA;
    else process.env.FEATURE_INVENTARIO_BODEGA = flagPrevio;
  }
});

it("construirPayload recorta, parsea packing y nunca incluye ubicacion", () => {
  expect(construirPayload(campos)).toEqual({ codigoPersonal: `${tag}A2`, packing: 18, observaciones: `${tag}O2` });
  expect(construirPayload(vacio)).toEqual({});
  expect(construirPayload({ ...campos, packing: "abc" })).toBeNull();
  expect(construirPayload({ ...campos, packing: "0" })).toEqual({ codigoPersonal: `${tag}A2`, packing: 0, observaciones: `${tag}O2` });
});

it("packing 0, -1 o no numerico no escribe; vacio no llama a la accion", async () => {
  for (const packing of ["0", "-1", "abc"])
    expect(await crearGuardar(updateProducto)(prod, { ...campos, packing })).toEqual({ ok: false, error: expect.stringMatching(/packing/i) });
  expect((await db.select().from(productos).where(eq(productos.id, prod)))[0].packing).toBe(12);
  const accion = vi.fn();
  expect(await crearGuardar(accion as never)(prod, vacio)).toBeNull();
  expect(accion).not.toHaveBeenCalled();
});

it("sin sesion: No autorizado y cero escrituras", async () => {
  vi.mocked(auth).mockResolvedValueOnce(null as never);
  expect(await crearGuardar(updateProducto)(prod, campos)).toEqual({ ok: false, error: "No autorizado" });
  const [p] = await db.select().from(productos).where(eq(productos.id, prod));
  expect([p.codigoPersonal, p.packing, p.observaciones]).toEqual([`${tag}ALIAS`, 12, `${tag}OBS`]);
});

it("doble clic hace una sola llamada con el payload sin ubicacion", async () => {
  const accion = vi.fn(async () => ({ ok: true as const, producto: {} }));
  const guardar = crearGuardar(accion as never);
  await Promise.all([guardar(prod, campos), guardar(prod, campos)]);
  expect(accion).toHaveBeenCalledTimes(1);
  expect(accion).toHaveBeenCalledWith(prod, { codigoPersonal: `${tag}A2`, packing: 18, observaciones: `${tag}O2` });
});

it("ON: editor con 3 campos tras el conteo, sin ubicacion ni costos", () => {
  const out = renderToStaticMarkup(createElement(FichaProducto, { fila: fila as never, usuarioId: "1" }));
  for (const t of ["Código personal", "Packing", "Observaciones", "Guardar cambios", `${tag}ALIAS`, "12", `${tag}OBS`]) expect(out).toContain(t);
  expect(out).not.toContain("ubicacion");
  expect(out).not.toMatch(/USD|M[oó]dulos|SENTINELA/i);
  expect(out.indexOf("Guardar conteo")).toBeLessThan(out.indexOf("Observaciones"));
});

it("conserva keys de conteo/historial y deja el editor solo en la ficha ON", () => {
  const fuente = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
  const ficha = fuente("app/(dashboard)/productos/[id]/FichaProducto.tsx");
  expect(ficha).toContain("key={`${usuarioId}:${fila.id}`}");
  expect(ficha).toContain("key={claveHistorial(usuarioId, fila.id, fila.posiciones)}");
  expect(ficha).toContain("<EditorFichaProducto");
  expect(fuente("app/(dashboard)/productos/[id]/page.tsx")).not.toContain("EditorFichaProducto");
});

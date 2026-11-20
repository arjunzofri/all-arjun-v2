/**
 * Fase B — INV-15 (INV-13.3 authWRITE): updateProducto autentica antes de
 * escribir, deriva el autor de la sesión y PATCH no acepta usuarioId del cliente.
 * DB TEST real, auth mockeado. ROJO contra la acción y ruta actuales.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { NextRequest } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, productos, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { updateProducto } from "@/lib/actions/productos";
import { PATCH } from "@/app/api/productos/[id]/route";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const tag = `EDT${Date.now().toString(36)}`;
const flagPrevio = process.env.FEATURE_INVENTARIO_BODEGA;
const UBI = `${tag}UBI`;
let uid = 0, prod = 0;
const ids: number[] = [];
const conSesion = (id: unknown = String(uid)) => vi.mocked(auth).mockResolvedValue({ user: { id } } as never);
const fila = async () => (await db.select().from(productos).where(eq(productos.id, prod)))[0];
const espiado = async <T>(fn: () => Promise<T>) => {
  const upd = vi.spyOn(db, "update"), ins = vi.spyOn(db, "insert");
  try { return { res: await fn(), upd, ins }; } finally { upd.mockRestore(); ins.mockRestore(); }
};
const sinEscrituras = (upd: MockInstance, ins: MockInstance) => {
  expect(upd).not.toHaveBeenCalled(); expect(ins).not.toHaveBeenCalled();
};
const patch = (id: string, body: unknown) => PATCH(new NextRequest(`https://app-arjun.local/api/productos/${id}`, {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}), { params: Promise.resolve({ id }) });

beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).host === process.env.PROD_DATABASE_URL_HOST)
    throw new Error("DATABASE_URL apunta a producción: se aborta antes de SQL");
  [uid] = (await db.insert(users).values({ username: `${tag}USR` }).returning({ id: users.id })).map((u) => u.id);
  [prod] = (await db.insert(productos).values({
    codigo: `${tag}P`, detalle: `${tag}DETALLE`, codigoPersonal: `${tag}ALIAS`,
    packing: 12, ubicacion: UBI, observaciones: `${tag}OBS`,
  }).returning({ id: productos.id })).map((p) => p.id);
  ids.push(prod);
});
beforeEach(async () => {
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
  conSesion();
  await db.update(productos).set({
    codigoPersonal: `${tag}ALIAS`, packing: 12, ubicacion: UBI, observaciones: `${tag}OBS`,
  }).where(eq(productos.id, prod));
});
afterAll(async () => {
  try {
    if (ids.length) await db.delete(activityLog).where(inArray(activityLog.entidadId, ids));
    if (ids.length) await db.delete(productos).where(inArray(productos.id, ids));
    if (uid) await db.delete(users).where(inArray(users.id, [uid]));
  } finally {
    if (flagPrevio === undefined) delete process.env.FEATURE_INVENTARIO_BODEGA;
    else process.env.FEATURE_INVENTARIO_BODEGA = flagPrevio;
  }
});

describe("updateProducto — autenticación y autor", () => {
  it("sin sesión o id de usuario inválido: No autorizado sin SQL", async () => {
    for (const sesion of [null, { user: { id: NaN } }, { user: { id: -1 } }, { user: { id: 0 } },
      { user: { id: 1.5 } }, { user: { id: 2 ** 53 } }, { user: {} }]) {
      vi.mocked(auth).mockResolvedValueOnce(sesion as never);
      const { res, upd, ins } = await espiado(() => updateProducto(prod, { codigoPersonal: "X" }));
      expect(res).toEqual({ ok: false, error: "No autorizado" });
      sinEscrituras(upd, ins);
    }
  });
  it("tercer argumento forjado no reemplaza el autor de la sesión", async () => {
    await (updateProducto as unknown as (id: number, input: object, usuarioId: number) => Promise<unknown>)(
      prod, { codigoPersonal: `${tag}ALIAS2` }, 987654);
    const [log] = await db.select().from(activityLog).where(and(
      eq(activityLog.entidadId, prod), eq(activityLog.accion, "update_codigo_personal"))).orderBy(desc(activityLog.id)).limit(1);
    expect(log?.usuarioId).toBe(uid);
  });
  it("rechaza IDs int4 inválidos e input inválido antes de escribir", async () => {
    for (const id of [NaN, -1, 0, 1.5, 2147483648]) {
      const { res, upd, ins } = await espiado(() => updateProducto(id, { packing: 9 }));
      expect(res.ok).toBe(false); sinEscrituras(upd, ins);
    }
    const { res, upd, ins } = await espiado(() => updateProducto(prod, { packing: -5 }));
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/packing/i) });
    sinEscrituras(upd, ins);
  });
});

describe("updateProducto — ubicación libre", () => {
  it("ON rechaza la clave ubicacion (incluso undefined) y no toca la fila", async () => {
    for (const input of [{ ubicacion: `${tag}NUEVA` }, { ubicacion: undefined }]) {
      const { res, upd, ins } = await espiado(() => updateProducto(prod, input));
      expect(res).toEqual({ ok: false, error: "La ubicación física se registra solo por conteo" });
      sinEscrituras(upd, ins);
      expect((await fila()).ubicacion).toBe(UBI);
    }
  });
  it("OFF actualiza ubicacion como hoy", async () => {
    process.env.FEATURE_INVENTARIO_BODEGA = "false";
    try {
      const res = await updateProducto(prod, { ubicacion: `${tag}LIBRE` });
      expect(res.ok).toBe(true);
      expect((await fila()).ubicacion).toBe(`${tag}LIBRE`);
    } finally { process.env.FEATURE_INVENTARIO_BODEGA = "true"; }
  });
});

describe("updateProducto — update parcial y auditoría", () => {
  it("packing preserva alias/obs/ubicación; el alias se audita con la sesión", async () => {
    expect((await updateProducto(prod, { packing: 24 })).ok).toBe(true);
    const p = await fila();
    expect([p.packing, p.codigoPersonal, p.observaciones, p.ubicacion]).toEqual([
      24, `${tag}ALIAS`, `${tag}OBS`, UBI]);
    expect((await updateProducto(prod, { codigoPersonal: `${tag}ALIAS3` })).ok).toBe(true);
    const [log] = await db.select().from(activityLog).where(and(
      eq(activityLog.entidadId, prod), eq(activityLog.accion, "update_codigo_personal"))).orderBy(desc(activityLog.id)).limit(1);
    expect(log?.usuarioId).toBe(uid);
    expect(log?.detalles).toMatchObject({ valor_nuevo: `${tag}ALIAS3` });
  });
});

describe("PATCH /api/productos/[id]", () => {
  it("sin sesión: 401 sin SQL", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { res, upd, ins } = await espiado(() => patch(String(prod), { packing: 10 }));
    expect(res.status).toBe(401); sinEscrituras(upd, ins);
  });
  it("ID inválido: 400", async () => {
    for (const id of ["abc", "0", "-1", "1.5", "2147483648"])
      expect((await patch(id, { packing: 10 })).status).toBe(400);
  });
  it("ON con clave ubicacion en el body crudo: 400 antes de SQL y fila intacta", async () => {
    const { res, upd, ins } = await espiado(() => patch(String(prod), { ubicacion: `${tag}PATCH` }));
    expect(res.status).toBe(400); sinEscrituras(upd, ins);
    expect((await fila()).ubicacion).toBe(UBI);
  });
  it("ON parcial válido: 200 con la misma forma de respuesta", async () => {
    const res = await patch(String(prod), { packing: 21, codigo: "hack" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["codigo", "codigoPersonal", "createdAt", "detalle",
      "id", "imagenUrl", "observaciones", "packing", "ubicacion", "updatedAt"]);
    expect([body.id, body.packing, body.codigoPersonal, body.ubicacion]).toEqual([prod, 21, `${tag}ALIAS`, UBI]);
    for (const k of ["compras", "precioUnitario", "bodegas", "modulos", "stock", "posiciones"])
      expect(body).not.toHaveProperty(k);
  });
});

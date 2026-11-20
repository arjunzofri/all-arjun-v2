// inv-20.3b — Backend de abrirProductoIdentificado. Local con DB TEST real; catalogo externo mockeado.
import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import { neon } from "@neondatabase/serverless";

const m = vi.hoisted(() => ({ auth: vi.fn(), externo: vi.fn(), upsert: vi.fn(), upsertReal: null as null | ((...a: never[]) => Promise<unknown>) }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/db/vidadigital/queries", () => ({ getProductoExternoPorCodigo: m.externo }));
vi.mock("@/lib/sync/compras-anil", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sync/compras-anil")>();
  m.upsertReal = actual.upsertProducto as never;
  return { ...actual, upsertProducto: m.upsert };
});
import { abrirProductoIdentificado } from "@/lib/actions/identificacion";

const sql = neon(process.env.DATABASE_URL!);
const TAG = `INV203-${Date.now()}`;
const cod = (s: string) => `${TAG}-${s}`;

async function fila(c: string) {
  const rows = (await sql`
    SELECT id, detalle, packing, imagen_url FROM productos
    WHERE upper(btrim(codigo)) = ${c.trim().toUpperCase()}
  `) as unknown as Record<string, unknown>[];
  return rows[0] ?? null;
}
async function veces(c: string): Promise<number> {
  const rows = (await sql`
    SELECT count(*)::int AS n FROM productos
    WHERE upper(btrim(codigo)) = ${c.trim().toUpperCase()}
  `) as unknown as { n: number }[];
  return rows[0].n;
}
const llamar = (codigos: string[], codigo: string) => abrirProductoIdentificado({ codigos, codigo });

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: 1, email: "qa@arjun.local", role: "operador" } });
  m.externo.mockResolvedValue(null);
  m.upsert.mockReset().mockImplementation((...a: never[]) => m.upsertReal!(...a));
  process.env.FEATURE_IDENTIFICACION_FOTO = "true";
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
});

afterAll(async () => {
  const propios = sql`SELECT id FROM productos WHERE upper(btrim(codigo)) LIKE ${`${TAG}-%`}`;
  await sql`DELETE FROM movimientos WHERE producto_id IN (${propios})`;
  await sql`DELETE FROM conteos_inventario WHERE producto_id IN (${propios})`;
  await sql`DELETE FROM stock WHERE producto_id IN (${propios})`;
  await sql`DELETE FROM productos WHERE upper(btrim(codigo)) LIKE ${`${TAG}-%`}`;
  delete process.env.FEATURE_IDENTIFICACION_FOTO;
  delete process.env.FEATURE_INVENTARIO_BODEGA;
});

describe("abrirProductoIdentificado() — guardas y validacion", () => {
  it("sin sesion o flags OFF: error como valor, sin externo ni escrituras", async () => {
    const c = cod("GUARD");
    m.auth.mockResolvedValue(null);
    expect(await llamar([c], c)).toEqual({ ok: false, error: "No autorizado" });
    m.auth.mockResolvedValue({ user: { id: 1 } });
    for (const flag of ["FEATURE_IDENTIFICACION_FOTO", "FEATURE_INVENTARIO_BODEGA"]) {
      process.env[flag] = "false";
      expect((await llamar([c], c)).ok).toBe(false);
      process.env[flag] = "true";
    }
    expect(m.externo).not.toHaveBeenCalled();
    expect(await veces(c)).toBe(0);
  });

  it("vacio, 51 codigos, 31 chars y codigo fuera de codigos: sin escribir", async () => {
    const c = cod("MAL");
    const casos = [
      { codigos: [""], codigo: "" },
      { codigos: Array.from({ length: 51 }, (_, i) => `${c}-${i}`), codigo: `${c}-0` },
      { codigos: ["X".repeat(31)], codigo: "X".repeat(31) },
      { codigos: [c], codigo: cod("FUERA") },
    ];
    for (const input of casos) expect((await abrirProductoIdentificado(input)).ok).toBe(false);
    expect(m.externo).not.toHaveBeenCalled();
    expect(await veces(c)).toBe(0);
    expect(await veces(cod("FUERA"))).toBe(0);
  });

  it("50 codigos: acepta el grupo y crea una sola fila", async () => {
    const c = cod("C50");
    const codigos = Array.from({ length: 50 }, (_, i) => `${c}-${i}`);
    const r = await llamar(codigos, codigos[0]);
    if (!r.ok) throw new Error(r.error);
    expect(r.incorporado).toBe(true);
    expect(await veces(codigos[0])).toBe(1);
  });

  it("creacion local que lanza: error como valor fijo, sin promesa rechazada", async () => {
    const c = cod("CREAFALLA");
    m.upsert.mockRejectedValueOnce(new Error("connect ECONNREFUSED postgres://u:p@host/db"));
    const r = await llamar([c], c);
    expect(r).toEqual({ ok: false, error: "No se pudo crear el producto. Intente nuevamente." });
    expect(JSON.stringify(r)).not.toContain("postgres");
    expect(await veces(c)).toBe(0);
  });
});

describe("abrirProductoIdentificado() — resolucion local", () => {
  it("otra variante o distinto caso del grupo: mismo id sin externo ni insert", async () => {
    const base = cod("Local");
    await sql`INSERT INTO productos (codigo) VALUES (${base})`;
    const id = (await fila(base))!.id;
    expect(await llamar([cod("V2"), ` ${base.toLowerCase()} `], cod("V2")))
      .toEqual({ ok: true, id, incorporado: false });
    expect(m.externo).not.toHaveBeenCalled();
    expect(await veces(base)).toBe(1);
  });
});

describe("abrirProductoIdentificado() — incorporacion externa", () => {
  it("solo externo: metadata del servidor y doble llamada deja una fila", async () => {
    const c = cod("EXT");
    m.externo.mockResolvedValue({ codigo: c, detalle: "Detalle VD", imagenUrl: "https://img.local/vd.jpg", packing: 12 });
    const r1 = await llamar([c], c);
    if (!r1.ok) throw new Error(r1.error);
    expect(r1.incorporado).toBe(true);
    expect(await fila(c)).toMatchObject({ id: r1.id, detalle: "Detalle VD", packing: 12, imagen_url: "https://img.local/vd.jpg" });
    expect(await llamar([c], c)).toMatchObject({ ok: true, id: r1.id, incorporado: false });
    expect(await veces(c)).toBe(1);
  });

  it("sin metadata externa: crea con nulos", async () => {
    const c = cod("NULO");
    const r = await llamar([c], c);
    if (!r.ok) throw new Error(r.error);
    expect(await fila(c)).toMatchObject({ id: r.id, detalle: null, packing: null, imagen_url: null });
  });

  it("catalogo externo que lanza: ok:false sin romper ni escribir", async () => {
    const c = cod("RED");
    m.externo.mockRejectedValue(new Error("network"));
    expect((await llamar([c], c)).ok).toBe(false);
    expect(await veces(c)).toBe(0);
  });
});

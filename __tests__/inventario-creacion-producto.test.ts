// inv-20.1 — Creacion manual de producto (backend). DB TEST real, cleanup por tag.
import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import { neon } from "@neondatabase/serverless";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { crearProductoManual } from "@/lib/actions/productos";

const sql = neon(process.env.DATABASE_URL!);
const mockAuth = auth as ReturnType<typeof vi.fn>;
const TAG = `INV20-${Date.now()}`;
const codigo = (s: string) => `${TAG}-${s}`;

async function fila(cod: string) {
  const rows = (await sql`
    SELECT id, detalle, packing, codigo_personal, observaciones, imagen_url, ubicacion
    FROM productos WHERE upper(btrim(codigo)) = ${cod.trim().toUpperCase()}
  `) as unknown as Record<string, unknown>[];
  return rows[0] ?? null;
}

async function veces(cod: string): Promise<number> {
  const rows = (await sql`
    SELECT count(*)::int AS n FROM productos
    WHERE upper(btrim(codigo)) = ${cod.trim().toUpperCase()}
  `) as unknown as { n: number }[];
  return rows[0].n;
}

beforeEach(() => {
  mockAuth.mockResolvedValue({ user: { id: 1, email: "qa@arjun.local", role: "operador" } });
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
});

afterAll(async () => {
  const tag = `${TAG}-%`;
  const propios = sql`SELECT id FROM productos WHERE upper(btrim(codigo)) LIKE ${tag}`;
  await sql`DELETE FROM movimientos WHERE producto_id IN (${propios})`;
  await sql`DELETE FROM conteos_inventario WHERE producto_id IN (${propios})`;
  await sql`DELETE FROM stock WHERE producto_id IN (${propios})`;
  await sql`DELETE FROM productos WHERE upper(btrim(codigo)) LIKE ${tag}`;
  delete process.env.FEATURE_INVENTARIO_BODEGA;
});

describe("crearProductoManual() — guardas y validacion", () => {
  it("sin sesion: No autorizado y cero filas", async () => {
    const cod = codigo("ANON");
    mockAuth.mockResolvedValue(null);
    expect(await crearProductoManual({ codigo: cod })).toEqual({ ok: false, error: "No autorizado" });
    expect(await fila(cod)).toBeNull();
  });

  it("flag inventario_bodega OFF: no habilitado y cero filas", async () => {
    const cod = codigo("OFF");
    process.env.FEATURE_INVENTARIO_BODEGA = "false";
    expect(await crearProductoManual({ codigo: cod })).toEqual({
      ok: false,
      error: "El inventario de bodega no está habilitado",
    });
    expect(await fila(cod)).toBeNull();
  });

  it("codigo vacio, 31 chars y packing invalido: error sin escribir", async () => {
    for (const input of [
      { codigo: "   " },
      { codigo: "X".repeat(31) },
      { codigo: codigo("PACKNEG"), packing: -1 },
      { codigo: codigo("PACKDEC"), packing: 1.5 },
    ]) {
      expect((await crearProductoManual(input)).ok).toBe(false);
      expect(await fila(input.codigo)).toBeNull();
    }
  });
});

describe("crearProductoManual() — creacion idempotente", () => {
  it("crea producto con detalle/packing y sin stock, conteos ni movimientos", async () => {
    const cod = codigo("CREA");
    const r = await crearProductoManual({ codigo: ` ${cod} `, detalle: "  Cargador ", packing: 0 });
    if (!r.ok) throw new Error(r.error);
    expect(r.existente).toBe(false);
    expect(await fila(cod)).toMatchObject({ id: r.id, detalle: "Cargador", packing: 0 });
    const asociadas = (await sql`
      SELECT
        (SELECT count(*) FROM stock WHERE producto_id = ${r.id})::int AS stock,
        (SELECT count(*) FROM conteos_inventario WHERE producto_id = ${r.id})::int AS conteos,
        (SELECT count(*) FROM movimientos WHERE producto_id = ${r.id})::int AS movimientos
    `) as unknown as { stock: number; conteos: number; movimientos: number }[];
    expect(asociadas[0]).toEqual({ stock: 0, conteos: 0, movimientos: 0 });
  });

  it("Promise.all doble: una sola fila y el mismo id", async () => {
    const cod = codigo("DOBLE");
    const [a, b] = await Promise.all([
      crearProductoManual({ codigo: cod }),
      crearProductoManual({ codigo: cod }),
    ]);
    if (!a.ok) throw new Error(a.error);
    if (!b.ok) throw new Error(b.error);
    expect(a.id).toBe(b.id);
    expect(await veces(cod)).toBe(1);
  });

  it("existente con alias/observaciones/imagen/ubicacion no se pisa", async () => {
    const cod = codigo("EXISTE");
    await sql`INSERT INTO productos (codigo, detalle, packing, codigo_personal, observaciones, imagen_url, ubicacion)
      VALUES (${cod}, 'Original', 5, 'ALIAS-1', 'obs', 'https://img.local/a.jpg', 'A1-F-1')`;
    const r = await crearProductoManual({
      codigo: cod,
      detalle: "Otro",
      packing: 9,
      imagenUrl: "https://img.local/b.jpg",
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.existente).toBe(true);
    expect(await fila(cod)).toMatchObject({
      id: r.id,
      detalle: "Original",
      packing: 5,
      codigo_personal: "ALIAS-1",
      observaciones: "obs",
      imagen_url: "https://img.local/a.jpg",
      ubicacion: "A1-F-1",
    });
  });

  it("codigo existente con otra capitalizacion y espacios: mismo id", async () => {
    const cod = codigo("Caso");
    const r1 = await crearProductoManual({ codigo: cod });
    const r2 = await crearProductoManual({ codigo: `  ${cod.toLowerCase()}  ` });
    if (!r1.ok) throw new Error(r1.error);
    if (!r2.ok) throw new Error(r2.error);
    expect(r2).toEqual({ ok: true, id: r1.id, existente: true });
    expect(await veces(cod)).toBe(1);
  });
});

// inv-20.3a — Lookup exacto read-only en Vida Digital. Cliente externo mockeado: sin red.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const m = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/db/vidadigital", () => ({ getVidaDigitalClient: () => ({ execute: m.execute }) }));
import { getProductoExternoPorCodigo } from "@/db/vidadigital/queries";

beforeEach(() => vi.clearAllMocks());

describe("getProductoExternoPorCodigo()", () => {
  it("sin filas: null", async () => {
    m.execute.mockResolvedValue({ rows: [] });
    expect(await getProductoExternoPorCodigo("ARJ-1")).toBeNull();
  });

  it("mapea codigo/detalle/imagenUrl/packing", async () => {
    m.execute.mockResolvedValue({
      rows: [{ codigo: "VD-9", detalle: "Cargador", imagen: "https://img.local/vd.jpg", cantcaja: 12 }],
    });
    expect(await getProductoExternoPorCodigo(" vd-9 ")).toEqual({
      codigo: "VD-9",
      detalle: "Cargador",
      imagenUrl: "https://img.local/vd.jpg",
      packing: 12,
    });
  });
});

describe("SQL de la query", () => {
  const src = readFileSync(join(process.cwd(), "db/vidadigital/queries.ts"), "utf8");
  const inicio = src.indexOf("export async function getProductoExternoPorCodigo");
  const bloque = src.slice(inicio, src.indexOf("\n}", inicio) + 2);

  it("exacta por upper(btrim), con ORDER BY determinista y LIMIT 1", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(bloque).toContain("upper(btrim(codigo)) = upper(btrim(");
    expect(bloque).toContain("ORDER BY");
    expect(bloque).toContain("LIMIT 1");
  });

  it("solo SELECT, sin INSERT/UPDATE/DELETE", () => {
    expect(bloque.toUpperCase()).toContain("SELECT");
    expect(bloque).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
  });
});

/**
 * inv-22b-1 — contrato de datos VD para el modo inventario.
 * getComprasAnilDesde(): opciones aditivas (incluirSinMetadata, limite) y
 * bodegaCodigo. Cliente VD mockeado: sin red, sin DB.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/db/vidadigital", () => ({
  getVidaDigitalClient: () => ({ execute: m.execute }),
}));

import { getComprasAnilDesde } from "@/db/vidadigital/queries";

/** Render de un SQL de drizzle: StringChunk.value[] + Param.value. */
function render(x: unknown): string {
  if (x && typeof x === "object") {
    const o = x as { queryChunks?: unknown[]; value?: unknown };
    if (Array.isArray(o.queryChunks)) return o.queryChunks.map(render).join("");
    if (Array.isArray(o.value)) return o.value.join("");
    if (o.value !== undefined) return String(o.value);
  }
  return String(x);
}

async function sqlDe(opciones?: { incluirSinMetadata?: boolean; limite?: number }) {
  m.execute.mockClear();
  m.execute.mockResolvedValue({ rows: [] });
  await getComprasAnilDesde("2026-01-01", opciones);
  return render(m.execute.mock.calls[0][0]);
}

function fila(over: Record<string, unknown> = {}) {
  return {
    folio: "F-1", fechanvt: "2026-01-01", fechconf: "2026-01-02",
    codigo: "COD-1", detalle: "Producto", cantidad: 3, cantcaja: 12,
    imagen_url: null, nro_ingreso: "101-26-000001-001-GLP", precdocd: null,
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("getComprasAnilDesde() — default idéntico al actual", () => {
  it("JOIN interno, orden actual y sin LIMIT", async () => {
    const t = await sqlDe();
    expect(t).toContain("JOIN (");
    expect(t).not.toContain("LEFT JOIN");
    expect(t).toContain("ORDER BY fechanvt DESC, folio DESC");
    expect(t).not.toMatch(/LIMIT \d/);
    expect(t).toContain("p.codigo,");
  });
});

describe("getComprasAnilDesde() — incluirSinMetadata (solo ON)", () => {
  it("LEFT JOIN en ambas ramas y código desde codunico", async () => {
    const t = await sqlDe({ incluirSinMetadata: true });
    expect(t.match(/LEFT JOIN/g)).toHaveLength(2);
    expect(t.match(/COALESCE\(p\.codigo, i\.codunico\) AS codigo/g)).toHaveLength(2);
    expect(t).toContain("ORDER BY fechanvt DESC, folio DESC");
  });
});

describe("getComprasAnilDesde() — limite (lotes)", () => {
  it("ORDER BY ascendente por confirmación y LIMIT", async () => {
    const t = await sqlDe({ limite: 100 });
    expect(t).toContain("ORDER BY fechconf ASC, folio ASC, codigo ASC LIMIT 100");
    expect(t).not.toContain("fechanvt DESC");
    expect(t).not.toContain("LEFT JOIN");
  });

  it("las dos opciones conviven", async () => {
    const t = await sqlDe({ incluirSinMetadata: true, limite: 100 });
    expect(t.match(/LEFT JOIN/g)).toHaveLength(2);
    expect(t).toContain("LIMIT 100");
  });
});

describe("getComprasAnilDesde() — porLinea (solo ON)", () => {
  it("una fila por linea real de VD, con su item", async () => {
    m.execute.mockResolvedValue({
      rows: [
        fila({ item: 1, cantidad: 20 }),
        fila({ item: 2, cantidad: 40 }),
      ],
    });
    const compras = await getComprasAnilDesde("2026-01-01", { porLinea: true });
    expect(compras.map((c) => [c.item, c.cantidad])).toEqual([[1, 20], [2, 40]]);
  });
});

describe("getComprasAnilDesde() — bodegaCodigo", () => {
  it("mapea el GL crudo, conocido y desconocido", async () => {
    m.execute.mockResolvedValue({
      rows: [
        fila({ folio: "F-GLP" }),
        fila({ folio: "F-GL2", nro_ingreso: "101-26-000002-001-GL2" }),
        fila({ folio: "F-GLX", nro_ingreso: "101-26-000003-001-GLX" }),
      ],
    });

    const compras = await getComprasAnilDesde("2026-01-01");
    const porFolio = new Map(compras.map((c) => [c.folio, c]));

    expect(porFolio.get("F-GLP")?.bodegaCodigo).toBe("GLP");
    expect(porFolio.get("F-GLP")?.bodega).toBe("Bodega 1 Vida Digital");
    expect(porFolio.get("F-GL2")?.bodegaCodigo).toBe("GL2");
    expect(porFolio.get("F-GLX")?.bodegaCodigo).toBe("GLX");
    expect(porFolio.get("F-GLX")?.bodega).toBe("Bodega desconocida");
  });
});

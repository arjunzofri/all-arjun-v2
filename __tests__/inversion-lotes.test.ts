/**
 * Fase B — Módulo 2, Slice 2: lotes de compra para valorización FIFO.
 *
 * 8.1 mocks       — mapeo/agrupación sin DB, incluido origen vida vs sanjh.
 * 8.2 integración — SELECT real contra Vida Digital (producto 1055).
 * 8.3 stock       — suma real del stock propio (incluye negativos).
 * 8.4 solo-lectura — el módulo no contiene escrituras a Vida Digital.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const { vdExecute, dbSelect, mockState } = vi.hoisted(() => ({
  vdExecute: vi.fn(),
  dbSelect: vi.fn(),
  mockState: { vida: false, stock: false },
}));

// Delegar al cliente real salvo que el test active el mock: los bloques
// de integración usan las conexiones reales (solo SELECT).
vi.mock("@/db/vidadigital", async () => {
  const actual = await vi.importActual<typeof import("@/db/vidadigital")>(
    "@/db/vidadigital"
  );
  return {
    getVidaDigitalClient: () =>
      mockState.vida
        ? ({ execute: vdExecute } as unknown as ReturnType<typeof actual.getVidaDigitalClient>)
        : actual.getVidaDigitalClient(),
  };
});

vi.mock("@/db", async () => {
  const actual = await vi.importActual<typeof import("@/db")>("@/db");
  return {
    db: {
      select: (...args: Parameters<typeof actual.db.select>) =>
        mockState.stock ? dbSelect(...args) : actual.db.select(...args),
    },
  };
});

import {
  getLotesCompraPorCodigo,
  getStockActualPorCodigo,
} from "@/lib/utils/inversion-lotes";
import { getVidaDigitalClient } from "@/db/vidadigital";
import { sql } from "drizzle-orm";

interface LineaCruda {
  knumfoli: string;
  kdocitem: string | null;
  cantsali: string | number;
}

/**
 * Consulta independiente: trae las líneas crudas y deduplica en JS por
 * (folio, kdocitem normalizado). No replica el DISTINCT ON de producción.
 */
async function sumaLíneasDeduplicadas(
  origen: "vida" | "sanjh",
  codigo: string,
  folio?: string
): Promise<number> {
  const client = getVidaDigitalClient();
  const result = await client.execute(sql`
    SELECT i.knumfoli, i.kdocitem, i.cantsali
    FROM ${sql.raw(origen)}.itemdcto i
    JOIN ${sql.raw(origen)}.movidcto m ON i.knumfoli = m.knumfoli
    WHERE i.codunico = ${codigo}
      ${folio === undefined ? sql`` : sql`AND i.knumfoli = ${folio}`}
      AND m.tipomovi = 'V'
      AND m.kcodcli2 IN (2, 20, 218)
      AND m.fechanvt >= '2023-09-01'
  `);

  const { rows } = result as unknown as { rows: LineaCruda[] };
  const porLinea = new Map<string, number>();
  for (const r of rows) {
    const item = r.kdocitem === null ? "" : String(r.kdocitem).trim();
    const key = `${r.knumfoli}|${item === "" ? "∅" : Number(item)}`;
    if (!porLinea.has(key)) porLinea.set(key, Number(r.cantsali));
  }
  return [...porLinea.values()].reduce((s, v) => s + v, 0);
}

function mockVidaRows(rows: unknown[]) {
  mockState.vida = true;
  vdExecute.mockResolvedValue({ rows });
}

function mockStockRows(rows: unknown[]) {
  mockState.stock = true;
  dbSelect.mockReturnValue({
    from: () => ({
      innerJoin: () => ({
        where: () => Promise.resolve(rows),
      }),
    }),
  });
}

beforeEach(() => {
  vdExecute.mockReset();
  dbSelect.mockReset();
  mockState.vida = false;
  mockState.stock = false;
});

// ── 8.1 Mocks ────────────────────────────────────────────────────────────
describe("getLotesCompraPorCodigo() — mocks", () => {
  it("mapea filas crudas a LoteCompra con números", async () => {
    mockVidaRows([
      {
        origen: "vida",
        folio: "001653",
        fecha: "2026-05-19",
        precdocd: "2.00",
        cantidad: "450",
      },
    ]);

    const lotes = await getLotesCompraPorCodigo("1055");

    expect(lotes).toEqual([
      {
        folio: "001653",
        fecha: "2026-05-19",
        cantidad: 450,
        costoUnitario: 2,
      },
    ]);
  });

  it("dos filas con el mismo folio pero distinto origen devuelven 2 lotes", async () => {
    mockVidaRows([
      {
        origen: "vida",
        folio: "001653",
        fecha: "2026-05-19",
        precdocd: "2.00",
        cantidad: "450",
      },
      {
        origen: "sanjh",
        folio: "001653",
        fecha: "2026-05-19",
        precdocd: "2.00",
        cantidad: "100",
      },
    ]);

    const lotes = await getLotesCompraPorCodigo("1055");

    expect(lotes).toHaveLength(2);
    expect(lotes.map((l) => l.folio)).toEqual(["001653", "001653"]);
    expect(lotes.map((l) => l.cantidad)).toEqual([450, 100]);
  });

  it("preserva fecha null y costo null", async () => {
    mockVidaRows([
      {
        origen: "vida",
        folio: "MAN-1",
        fecha: null,
        precdocd: null,
        cantidad: "5",
      },
    ]);

    const lotes = await getLotesCompraPorCodigo("MANUAL");

    expect(lotes).toEqual([
      {
        folio: "MAN-1",
        fecha: null,
        cantidad: 5,
        costoUnitario: null,
      },
    ]);
  });

  it("sin filas devuelve []", async () => {
    mockVidaRows([]);
    await expect(getLotesCompraPorCodigo("NO-EXISTE")).resolves.toEqual([]);
  });
});

// ── 8.2 Integración real (solo SELECT) ───────────────────────────────────
describe("getLotesCompraPorCodigo() — integración real", () => {
  it("producto 1055: 3 lotes, líneas deduplicadas", async () => {
    const lotes = await getLotesCompraPorCodigo("1055");
    const esperadoVida1653 = await sumaLíneasDeduplicadas(
      "vida",
      "1055",
      "001653"
    );

    expect(lotes).toEqual([
      {
        folio: "001710",
        fecha: "2024-10-28",
        cantidad: 390,
        costoUnitario: 2,
      },
      {
        folio: "002418",
        fecha: "2025-02-19",
        cantidad: 60,
        costoUnitario: 2,
      },
      {
        folio: "001653",
        fecha: "2026-05-19",
        cantidad: esperadoVida1653,
        costoUnitario: 2,
      },
    ]);

    expect(esperadoVida1653).toBeGreaterThan(0);
  });

  it("5 códigos sanjh: total == líneas deduplicadas (consulta independiente)", async () => {
    const codigos = [
      "TMQ-KM-3024",
      "1125",
      "ZS003",
      "1029",
      "CWJ-KM-CW16",
    ];

    for (const codigo of codigos) {
      const lotes = await getLotesCompraPorCodigo(codigo);
      const total = lotes.reduce((s, l) => s + l.cantidad, 0);
      const esperado = await sumaLíneasDeduplicadas("sanjh", codigo);
      expect(total, codigo).toBe(esperado);
    }
  });

  it("código inexistente devuelve []", async () => {
    await expect(
      getLotesCompraPorCodigo("NO-EXISTE-EN-VIDA-DIGITAL")
    ).resolves.toEqual([]);
  });
});

// ── 8.3 Stock propio ─────────────────────────────────────────────────────
describe("getStockActualPorCodigo() — stock", () => {
  it("devuelve la suma real del stock (integración, producto 1055)", async () => {
    await expect(getStockActualPorCodigo("1055")).resolves.toBe(466);
  });

  it("producto inexistente → 0", async () => {
    await expect(
      getStockActualPorCodigo("NO-EXISTE-EN-STOCK")
    ).resolves.toBe(0);
  });

  it("no hace clamp: suma negativa se devuelve tal cual (mock)", async () => {
    mockStockRows([{ total: -7 }]);
    await expect(getStockActualPorCodigo("NEGATIVO")).resolves.toBe(-7);
  });
});

// ── 8.4 Solo lectura ─────────────────────────────────────────────────────
describe("inversion-lotes.ts — solo lectura a Vida Digital", () => {
  const src = readFileSync(
    resolve(__dirname, "../lib/utils/inversion-lotes.ts"),
    "utf8"
  );

  it("no contiene verbos de escritura SQL", () => {
    for (const verbo of [
      "INSERT",
      "UPDATE",
      "DELETE",
      "TRUNCATE",
      "DROP",
      "ALTER",
      "CREATE",
    ]) {
      expect(src).not.toMatch(new RegExp(`\\b${verbo}\\b`, "i"));
    }
  });

  it("consulta ambos esquemas y usa el cliente read-only", () => {
    expect(src).toMatch(/getVidaDigitalClient/);
    expect(src).toMatch(/\bvida\b/);
    expect(src).toMatch(/\bsanjh\b/);
  });
});

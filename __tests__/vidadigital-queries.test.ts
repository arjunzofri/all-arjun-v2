/**
 * Fase B — Slice 02: Tests que intentan romper las queries a Vida Digital.
 *
 * Riesgos: R1 duplicados, R2 fechanvt NULL, R3 código no reconocido → null,
 * R4 sin límite, R5 SQL injection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "drizzle-orm";

// Imports reales — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import {
  getComprasAnilDesde,
  buscarProductoHistorico,
  getEstadoNotasVd,
} from "@/db/vidadigital/queries";
import { getVidaDigitalClient } from "@/db/vidadigital";
import { getBodegaPorCodigoIngreso } from "@/lib/utils/get-bodega-por-codigo-ingreso";

// ── R3: Códigos de bodega ──────────────────────────────────────────────
describe("getBodegaPorCodigoIngreso()", () => {
  it("GLP → Bodega 1 Vida Digital", () => {
    expect(getBodegaPorCodigoIngreso("GLP")).toBe("Bodega 1 Vida Digital");
  });

  it("GL1 → Bodega 2 Vida Digital", () => {
    expect(getBodegaPorCodigoIngreso("GL1")).toBe("Bodega 2 Vida Digital");
  });

  it("GL2 → Bodega 1 Vida Digital (administrativo)", () => {
    expect(getBodegaPorCodigoIngreso("GL2")).toBe("Bodega 1 Vida Digital");
  });

  it("código desconocido → null (no lanza)", () => {
    expect(getBodegaPorCodigoIngreso("XYZ")).toBeNull();
    expect(getBodegaPorCodigoIngreso("")).toBeNull();
    expect(getBodegaPorCodigoIngreso("GL3")).toBeNull();
  });
});

// ── R1, R2, R5: Compras Anil ──────────────────────────────────────────
describe("getComprasAnilDesde()", () => {
  it("devuelve array (vacío o no) sin lanzar", async () => {
    const rows = await getComprasAnilDesde("2026-06-01");
    expect(Array.isArray(rows)).toBe(true);
  });

  // R1: cada row tiene identificador único (folio + item) para detectar duplicados
  it("cada resultado tiene folio + código de producto", async () => {
    const rows = await getComprasAnilDesde("2026-06-15");
    for (const r of rows) {
      expect(r).toHaveProperty("folio");
      expect(r).toHaveProperty("codigo");
      expect(r).toHaveProperty("cantidad");
      expect(r).toHaveProperty("bodega");
    }
  });

  // R2: fechanvt NULL no debería aparecer
  it("no devuelve filas con fechanvt NULL", async () => {
    const rows = await getComprasAnilDesde("2026-06-01");
    const sinFecha = rows.filter((r) => !r.fechanvt);
    expect(sinFecha.length).toBe(0);
  });

  // T5 (fix 3, read-only): el mismo producto en dos bodegas de la misma nota
  // sale como dos filas independientes, cada una con su cantidad.
  it("T5: 002331 / MK0-216 trae Bodega 1 (2) y Bodega 2 (13)", async () => {
    const filas = (await getComprasAnilDesde("2026-06-01")).filter(
      (r) => r.folio === "002331" && r.codigo === "MK0-216",
    );
    const porBodega = new Map(filas.map((r) => [r.bodega, r.cantidad]));
    expect(porBodega.get("Bodega 1 Vida Digital")).toBe(2);
    expect(porBodega.get("Bodega 2 Vida Digital")).toBe(13);
    expect(filas).toHaveLength(2);
  });
});

// ── R4, R5: Buscador histórico ────────────────────────────────────────
describe("buscarProductoHistorico()", () => {
  it("devuelve array limitado sin lanzar", async () => {
    const rows = await buscarProductoHistorico("test");
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeLessThanOrEqual(20);
  });

  // R4: sin límite revienta — verificamos que hay LIMIT
  it("nunca devuelve más de 20 resultados", async () => {
    const rows = await buscarProductoHistorico("a"); // query amplia
    expect(rows.length).toBeLessThanOrEqual(20);
  });

  // R5: SQL injection vía query string
  it("no explota con comillas ni caracteres SQL", async () => {
    const rows = await buscarProductoHistorico("'; DROP TABLE productos; --");
    expect(Array.isArray(rows)).toBe(true);
  });

  // Solo devuelve código, detalle, imagen_url — nunca cantidad ni bodega
  it("nunca expone cantidad ni bodega", async () => {
    const rows = await buscarProductoHistorico("1161");
    for (const r of rows) {
      expect(r).toHaveProperty("codigo");
      expect(r).toHaveProperty("detalle");
      // imagen_url puede ser null — no la exigimos
      // Estas NO deben existir:
      expect(r).not.toHaveProperty("cantidad");
      expect(r).not.toHaveProperty("bodega");
      expect(r).not.toHaveProperty("saldo");
      expect(r).not.toHaveProperty("fechanvt");
    }
  });
});

// ── FASE B: regla de líneas válidas (pestadot='3' + dedup kdocitem) ────
// Misma regla ya validada en lib/utils/inversion-lotes.ts (commit e4cb0ff):
//   1. solo i.pestadot = '3'
//   2. una fila por (knumfoli, codunico, NULLIF(TRIM(kdocitem),'')::int)
//      vía DISTINCT ON, por esquema.
//
// Fixture 002515: en la evidencia (_poc_tmp/regla_combinada.out) figuraba
// como nota en borrador (pestadot='1'). Hoy 2026-11-10 vida.movidcto y sus
// 6 líneas ya están en pestadot='3' (val_doc 8669.60): fue confirmada.
// No existe hoy ninguna nota 100% borrador con fechanvt >= 2026-05-01, así
// que el caso (a) verifica la exclusión de las líneas borrador de 001653.

type CompraAnilRow = Awaited<ReturnType<typeof getComprasAnilDesde>>[number];

const CORTE = "2026-05-01";

/** Cantidad total por código de una nota (suma de bodegas/visaciones). */
function cantidadesPorCodigo(rows: CompraAnilRow[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const r of rows) mapa.set(r.codigo, (mapa.get(r.codigo) ?? 0) + r.cantidad);
  return mapa;
}

function totalNota(rows: CompraAnilRow[]): number {
  return rows.reduce((s, r) => s + r.cantidad, 0);
}

/**
 * Oráculo independiente: suma de líneas pestadot='3' deduplicadas por
 * (folio, codigo, kdocitem int), calculada por esquema. Solo SELECT.
 */
async function sumaOraculo(folio: string): Promise<number> {
  const db = getVidaDigitalClient();
  let total = 0;
  for (const esq of ["vida", "sanjh"] as const) {
    const res = await db.execute(
      sql`
        SELECT COALESCE(SUM(z.cantsali), 0)::int AS total
        FROM (
          SELECT DISTINCT ON (
            i.knumfoli, i.codunico, NULLIF(TRIM(i.kdocitem), '')::int
          )
            i.knumfoli, i.codunico, i.cantsali
          FROM ${sql.raw(esq)}.itemdcto i
          JOIN ${sql.raw(esq)}.movidcto m ON i.knumfoli = m.knumfoli
          WHERE i.knumfoli = ${folio}
            AND i.pestadot = '3'
            AND m.tipomovi = 'V'
            AND m.kcodcli2 IN (2, 20, 218)
            AND m.fechanvt >= ${CORTE}
          ORDER BY
            i.knumfoli, i.codunico, NULLIF(TRIM(i.kdocitem), '')::int
        ) z
      `
    );
    const { rows } = res as unknown as { rows: { total: number | string }[] };
    total += Number(rows[0]?.total ?? 0);
  }
  return total;
}

describe("getComprasAnilDesde — regla de líneas válidas", () => {
  let compras: CompraAnilRow[];

  beforeAll(async () => {
    compras = await getComprasAnilDesde(CORTE);
  });

  it("(a) excluye líneas en borrador: 001653 no trae A2 (400) ni 8060 (60)", () => {
    const c = cantidadesPorCodigo(compras.filter((r) => r.folio === "001653"));
    // Ambas existen SOLO con pestadot='1' en 001653.
    expect(c.has("A2")).toBe(false);
    expect(c.has("8060")).toBe(false);
    // Los códigos confirmados sí están.
    expect(c.get("1055")).toBe(450);
    expect(c.get("V-640S4")).toBe(30);
  });

  it("(b) 001986: HR-6=1000, HN-1=200, HN-2=144, EGD-100=5, suma=1536", () => {
    const filas = compras.filter((r) => r.folio === "001986");
    const c = cantidadesPorCodigo(filas);
    expect(c.get("HR-6")).toBe(1000);
    expect(c.get("HN-1")).toBe(200);
    expect(c.get("HN-2")).toBe(144);
    expect(c.get("EGD-100")).toBe(5);
    expect(totalNota(filas)).toBe(1536);
  });

  it("(c) 001987: S-266=300, T-501=120, LP-02=20, suma=952", () => {
    const filas = compras.filter((r) => r.folio === "001987");
    const c = cantidadesPorCodigo(filas);
    expect(c.get("S-266")).toBe(300);
    expect(c.get("T-501")).toBe(120);
    expect(c.get("LP-02")).toBe(20);
    expect(totalNota(filas)).toBe(952);
  });

  it("(d) 001653: suma de la nota = oráculo pestadot='3' deduplicado", async () => {
    const filas = compras.filter((r) => r.folio === "001653");
    expect(totalNota(filas)).toBe(await sumaOraculo("001653"));
  });
});

// ── FASE B fix 4: el corte es la fecha de CONFIRMACION (fechconf) ──────
// Una nota confirmada tarde (fechconf muy posterior a fechanvt) debe entrar
// aunque su fechanvt quede antes del corte. Fixtures verificados read-only:
//   002228 vida  fechanvt 2026-09-02 / fechconf 2026-09-15
//   002109 vida  fechanvt 2026-08-04 / fechconf 2026-08-04
//   001220 vida  fechanvt 2026-02-11 / fechconf 2026-03-31 (lag 48 dias)
describe("getComprasAnilDesde — corte por fecha de confirmación", () => {
  it("002228 entra con corte 2026-09-01 (confirmada el 15)", async () => {
    const rows = await getComprasAnilDesde("2026-09-01");
    expect(rows.some((r) => r.folio === "002228")).toBe(true);
  });

  it("cada compra trae fechconf >= 2026-09-01", async () => {
    const rows = await getComprasAnilDesde("2026-09-01");
    expect(rows.length).toBeGreaterThan(0);
    const viejas = rows.filter((r) => (r.fechconf ?? "") < "2026-09-01");
    expect(viejas).toEqual([]);
  });

  it("002228 entra con corte 2026-09-14 aunque su fechanvt sea 2026-09-02", async () => {
    const rows = await getComprasAnilDesde("2026-09-14");
    expect(rows.some((r) => r.folio === "002228")).toBe(true);
  });

  it("002109 (fechconf 2026-08-04) NO entra con corte 2026-09-14", async () => {
    const rows = await getComprasAnilDesde("2026-09-14");
    expect(rows.some((r) => r.folio === "002109")).toBe(false);
  });

  it("001220 (fechanvt 2026-02-11, fechconf 2026-03-31) entra con corte 2026-03-01", async () => {
    const filas = (await getComprasAnilDesde("2026-03-01")).filter(
      (r) => r.folio === "001220"
    );
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.every((r) => r.fechconf === "2026-03-31")).toBe(true);
  });
});

// ── getEstadoNotasVd: read-only contra Vida Digital ────────────────────
describe("getEstadoNotasVd()", () => {
  it("001986 existe confirmada; 999999 no existe", async () => {
    const estados = await getEstadoNotasVd(["001986", "002515", "999999"]);
    const porFolio = new Map(estados.map((e) => [e.folio, e]));

    const nota = porFolio.get("001986");
    expect(nota?.existe).toBe(true);
    expect(nota?.fechconf).toBe("2026-08-05");
    expect(nota?.lineasValidas).toBeGreaterThan(0);

    expect(porFolio.get("002515")?.existe).toBe(true);

    const inexistente = porFolio.get("999999");
    expect(inexistente?.existe).toBe(false);
    expect(inexistente?.fechconf).toBeNull();
    expect(inexistente?.lineasConfirmadas).toBe(0);
  });
});

/**
 * Fase B — Módulo 2, Slice 6: notas reales de Anil (opt-in).
 *
 * Solo corre con INVERSION_REAL=1 (PowerShell: $env:INVERSION_REAL="1").
 * Consulta Vida Digital en modo lectura, con la misma regla que lotesQuery:
 * líneas confirmadas (pestadot = '3') + dedup por (código, folio, kdocitem).
 */

import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { getVidaDigitalClient } from "@/db/vidadigital";
import { getLotesCompraPorCodigos } from "@/lib/utils/inversion-lotes";
import type { LoteCompra } from "@/lib/utils/inversion-fifo";

const REAL = process.env.INVERSION_REAL === "1";

const round2 = (x: number) => Math.round(x * 100) / 100;

interface FilaCodigo {
  codigo: string;
}

async function codigosDeFolio(
  esquema: "vida" | "sanjh",
  folio: string,
  soloConfirmadas: boolean
): Promise<string[]> {
  const client = getVidaDigitalClient();
  const result = await client.execute(sql`
    SELECT DISTINCT i.codunico AS codigo
    FROM ${sql.raw(esquema)}.itemdcto i
    WHERE i.knumfoli = ${folio}
      ${soloConfirmadas ? sql`AND i.pestadot = '3'` : sql``}
    ORDER BY i.codunico
  `);
  const { rows } = result as unknown as { rows: FilaCodigo[] };
  return rows.map((r) => r.codigo);
}

/** Lotes de producción de un folio, filtrados por esquema de origen. */
async function lotesDeFolio(
  esquema: "vida" | "sanjh",
  folio: string
): Promise<LoteCompra[]> {
  const codigos = await codigosDeFolio(esquema, folio, true);
  const mapa = await getLotesCompraPorCodigos(codigos);
  return codigos.flatMap((c) =>
    (mapa.get(c) ?? []).filter(
      (l) => l.origen === esquema && l.folio === folio
    )
  );
}

interface FilaReconciliacion {
  knumfoli: string;
  vd: string;
  total: string | null;
}

/**
 * Reconciliación por folio: Σ(cantidad × costoUnitario) de las líneas válidas
 * contra movidcto.val_doc. Misma regla que lotesQuery (pestadot='3' +
 * DISTINCT ON por código/folio/kdocitem normalizado).
 */
async function reconciliar(esquema: "vida" | "sanjh") {
  const client = getVidaDigitalClient();
  const result = await client.execute(sql`
    SELECT m.knumfoli, m.val_doc::numeric AS vd, c.total
    FROM (
      SELECT knumfoli, val_doc
      FROM ${sql.raw(esquema)}.movidcto
      WHERE tipomovi = 'V'
        AND kcodcli2 IN (2, 20, 218)
        AND fechanvt >= '2023-09-01'
    ) m
    LEFT JOIN (
      SELECT knumfoli, SUM(cantsali * precdocd) AS total
      FROM (
        SELECT DISTINCT ON (
          codunico, knumfoli, NULLIF(TRIM(kdocitem), '')::int
        )
          knumfoli, cantsali, precdocd
        FROM ${sql.raw(esquema)}.itemdcto
        WHERE pestadot = '3'
        ORDER BY codunico, knumfoli, NULLIF(TRIM(kdocitem), '')::int
      ) z
      GROUP BY knumfoli
    ) c USING (knumfoli)
    ORDER BY m.knumfoli
  `);
  const { rows } = result as unknown as { rows: FilaReconciliacion[] };

  const noCuadran = rows
    .filter(
      (r) =>
        r.total === null || Math.abs(Number(r.total) - Number(r.vd)) >= 0.05
    )
    .map((r) => r.knumfoli);

  return { folios: rows.length, noCuadran };
}

describe.skipIf(!REAL)("notas reales de Anil — INVERSION_REAL=1", () => {
  it("1. 001986: cantidades por código (solo líneas confirmadas)", async () => {
    const mapa = await getLotesCompraPorCodigos([
      "HR-6",
      "HN-1",
      "HN-2",
      "EGD-100",
    ]);

    const vida = (codigo: string) =>
      (mapa.get(codigo) ?? []).filter(
        (l) => l.origen === "vida" && l.folio === "001986"
      );

    expect(vida("HR-6").map((l) => l.cantidad)).toEqual([1000]);
    expect(vida("HN-1").map((l) => l.cantidad)).toEqual([200]);
    expect(vida("HN-2").map((l) => l.cantidad)).toEqual([144]);
    expect(vida("EGD-100").map((l) => l.cantidad)).toEqual([5]);
  });

  it("2. 001986: 1536 unidades y USD 9.080,30", async () => {
    const lotes = await lotesDeFolio("vida", "001986");

    const unidades = lotes.reduce((s, l) => s + l.cantidad, 0);
    const valor = round2(
      lotes.reduce((s, l) => s + l.cantidad * (l.costoUnitario ?? 0), 0)
    );

    expect(unidades).toBe(1536);
    expect(valor).toBe(9080.3);
  });

  it("3. 001987: cantidades, 952 unidades y USD 3.578,00", async () => {
    const mapa = await getLotesCompraPorCodigos(["S-266", "T-501", "LP-02"]);

    const vida = (codigo: string) =>
      (mapa.get(codigo) ?? []).filter(
        (l) => l.origen === "vida" && l.folio === "001987"
      );

    expect(vida("S-266").map((l) => l.cantidad)).toEqual([300]);
    expect(vida("T-501").map((l) => l.cantidad)).toEqual([120]);
    expect(vida("LP-02").map((l) => l.cantidad)).toEqual([20]);

    const lotes = await lotesDeFolio("vida", "001987");
    const unidades = lotes.reduce((s, l) => s + l.cantidad, 0);
    const valor = round2(
      lotes.reduce((s, l) => s + l.cantidad * (l.costoUnitario ?? 0), 0)
    );

    expect(unidades).toBe(952);
    expect(valor).toBe(3578);
  });

  it("4. 002515: sin lotes (nota en borrador)", async () => {
    // Se piden todos sus códigos, sin filtrar pestadot, porque sus líneas
    // están en borrador; producción debe devolver 0 lotes para ese folio.
    const codigos = await codigosDeFolio("vida", "002515", false);
    expect(codigos.length).toBeGreaterThan(0);

    const mapa = await getLotesCompraPorCodigos(codigos);
    const delFolio = codigos.flatMap((c) =>
      (mapa.get(c) ?? []).filter((l) => l.folio === "002515")
    );

    expect(delFolio).toEqual([]);
  });

  it("5. reconciliación: 214/215 notas cuadran con movidcto.val_doc", async () => {
    const vida = await reconciliar("vida");
    const sanjh = await reconciliar("sanjh");

    expect(vida).toEqual({ folios: 75, noCuadran: ["002515"] });
    expect(sanjh).toEqual({ folios: 140, noCuadran: [] });

    const total = vida.folios + sanjh.folios;
    const cuadran =
      total - vida.noCuadran.length - sanjh.noCuadran.length;

    expect(total).toBe(215);
    expect(cuadran).toBe(214);
  });

  it("6. patrón A: 1055 sigue con 3 lotes deduplicados", async () => {
    const mapa = await getLotesCompraPorCodigos(["1055"]);
    const lotes = mapa.get("1055") ?? [];

    expect(lotes).toHaveLength(3);
    expect(lotes.map((l) => l.folio).sort()).toEqual([
      "001653",
      "001710",
      "002418",
    ]);
    expect(lotes.map((l) => l.origen)).toEqual(["sanjh", "sanjh", "vida"]);
  });
});

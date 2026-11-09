import { describe, it, expect } from "vitest";
import { calcularInversionFifo } from "@/lib/utils/inversion-fifo";
import type { LoteCompra } from "@/lib/utils/inversion-fifo";

// ── E1 — stock 0 ──────────────────────────────────────────────────────────

describe("calcularInversionFifo — E1 stock 0", () => {
  it("conserva la partida con remanente 0 y valor 0", () => {
    const lotes: LoteCompra[] = [
      { folio: "F1", fecha: "2024-01-01", cantidad: 10, costoUnitario: 5 },
    ];

    const r = calcularInversionFifo(lotes, 0);

    expect(r.partidas).toEqual([
      {
        folio: "F1",
        fecha: "2024-01-01",
        cantidadComprada: 10,
        cantidadRemanente: 0,
        costoUnitario: 5,
        valor: 0,
      },
    ]);
    expect(r.valorTotal).toBe(0);
    expect(r.cantidadTotalCompras).toBe(10);
    expect(r.cantidadValorizada).toBe(0);
    expect(r.cantidadSinCosto).toBe(0);
    expect(r.stockActual).toBe(0);
  });
});

// ── E2 — stock 60 cubierto por las compras más recientes ──────────────────

describe("calcularInversionFifo — E2 stock 60", () => {
  const lotes: LoteCompra[] = [
    { folio: "A", fecha: "2023-09-01", cantidad: 100, costoUnitario: 2 },
    { folio: "B", fecha: "2024-01-15", cantidad: 50, costoUnitario: 3 },
    { folio: "C", fecha: "2024-06-01", cantidad: 30, costoUnitario: 4 },
  ];

  it("asigna el stock a las compras más recientes, en orden C, B, A", () => {
    const r = calcularInversionFifo(lotes, 60);

    expect(r.partidas).toEqual([
      {
        folio: "C",
        fecha: "2024-06-01",
        cantidadComprada: 30,
        cantidadRemanente: 30,
        costoUnitario: 4,
        valor: 120,
      },
      {
        folio: "B",
        fecha: "2024-01-15",
        cantidadComprada: 50,
        cantidadRemanente: 30,
        costoUnitario: 3,
        valor: 90,
      },
      {
        folio: "A",
        fecha: "2023-09-01",
        cantidadComprada: 100,
        cantidadRemanente: 0,
        costoUnitario: 2,
        valor: 0,
      },
    ]);
    expect(r.valorTotal).toBe(210);
    expect(r.cantidadValorizada).toBe(60);
    expect(r.cantidadSinCosto).toBe(0);
  });

  it("da el mismo resultado con el input barajado", () => {
    const barajado = [lotes[2], lotes[0], lotes[1]];

    expect(calcularInversionFifo(barajado, 60)).toEqual(
      calcularInversionFifo(lotes, 60)
    );
  });
});

// ── E3 — stock mayor que todas las compras ────────────────────────────────

describe("calcularInversionFifo — E3 stock 200 > compras 180", () => {
  it("valora todas las compras y deja 20 sin costo", () => {
    const lotes: LoteCompra[] = [
      { folio: "A", fecha: "2023-09-01", cantidad: 100, costoUnitario: 2 },
      { folio: "B", fecha: "2024-01-15", cantidad: 50, costoUnitario: 3 },
      { folio: "C", fecha: "2024-06-01", cantidad: 30, costoUnitario: 4 },
    ];

    const r = calcularInversionFifo(lotes, 200);

    expect(r.partidas.map((p) => [p.folio, p.cantidadRemanente, p.valor])).toEqual([
      ["C", 30, 120],
      ["B", 50, 150],
      ["A", 100, 200],
    ]);
    expect(r.valorTotal).toBe(470);
    expect(r.cantidadValorizada).toBe(180);
    expect(r.cantidadSinCosto).toBe(20);
  });
});

// ── E4 — fechas iguales, desempate folio descendente ──────────────────────

describe("calcularInversionFifo — E4 empate de fecha", () => {
  it("desempata por folio descendente", () => {
    const lotes: LoteCompra[] = [
      { folio: "A200", fecha: "2024-06-01", cantidad: 10, costoUnitario: 7 },
      { folio: "B100", fecha: "2024-06-01", cantidad: 10, costoUnitario: 5 },
    ];

    const r = calcularInversionFifo(lotes, 12);

    expect(r.partidas.map((p) => [p.folio, p.cantidadRemanente, p.valor])).toEqual([
      ["B100", 10, 50],
      ["A200", 2, 14],
    ]);
    expect(r.valorTotal).toBe(64);
    expect(r.cantidadValorizada).toBe(12);
    expect(r.cantidadSinCosto).toBe(0);
  });
});

// ── E5 — decimales con redondeo ───────────────────────────────────────────

describe("calcularInversionFifo — E5 redondeo", () => {
  it("redondea cada partida a 2 decimales y reconcilia el total", () => {
    const lotes: LoteCompra[] = [
      { folio: "A", fecha: "2024-03-01", cantidad: 3.5, costoUnitario: 1.2345 },
      { folio: "B", fecha: "2024-05-01", cantidad: 2.25, costoUnitario: 0.1 },
    ];

    const r = calcularInversionFifo(lotes, 2.75);

    expect(r.partidas.map((p) => [p.folio, p.cantidadRemanente, p.valor])).toEqual([
      ["B", 2.25, 0.23],
      ["A", 0.5, 0.62],
    ]);
    expect(r.valorTotal).toBe(0.85);
    expect(r.cantidadValorizada).toBe(2.75);
    expect(r.cantidadSinCosto).toBe(0);
  });
});

// ── E6 — lotes desordenados + lote sin costo ──────────────────────────────

describe("calcularInversionFifo — E6 desordenados + sin costo", () => {
  it("ordena, consume stock del lote sin costo y lo excluye de la valorización", () => {
    const lotes: LoteCompra[] = [
      { folio: "B", fecha: "2024-01-15", cantidad: 20, costoUnitario: 3.5 },
      { folio: "C", fecha: "2024-06-01", cantidad: 10, costoUnitario: null },
      { folio: "A", fecha: "2023-09-01", cantidad: 5, costoUnitario: 2 },
    ];

    const r = calcularInversionFifo(lotes, 15);

    expect(r.partidas.map((p) => [p.folio, p.cantidadRemanente, p.valor])).toEqual([
      ["C", 10, null],
      ["B", 5, 17.5],
      ["A", 0, 0],
    ]);
    expect(r.valorTotal).toBe(17.5);
    expect(r.cantidadValorizada).toBe(5);
    expect(r.cantidadSinCosto).toBe(10);
  });
});

// ── Lotes vacíos ──────────────────────────────────────────────────────────

describe("calcularInversionFifo — lotes vacíos", () => {
  it("devuelve todo en cero y el stock entero como sin costo", () => {
    const r = calcularInversionFifo([], 42);

    expect(r.partidas).toEqual([]);
    expect(r.valorTotal).toBe(0);
    expect(r.cantidadTotalCompras).toBe(0);
    expect(r.cantidadValorizada).toBe(0);
    expect(r.cantidadSinCosto).toBe(42);
    expect(r.stockActual).toBe(42);
  });
});

// ── Validación — negativos ────────────────────────────────────────────────

describe("calcularInversionFifo — validación", () => {
  it("lanza RangeError si stockActual < 0", () => {
    expect(() => calcularInversionFifo([], -1)).toThrow(RangeError);
  });

  it("lanza RangeError si algún lote tiene cantidad negativa, con el folio en el mensaje", () => {
    const lotes: LoteCompra[] = [
      { folio: "NEG-1", fecha: "2024-01-01", cantidad: -3, costoUnitario: 1 },
    ];

    expect(() => calcularInversionFifo(lotes, 10)).toThrow(RangeError);
    expect(() => calcularInversionFifo(lotes, 10)).toThrow(/NEG-1/);
  });

  it("lanza RangeError si algún lote tiene costoUnitario negativo, con el folio en el mensaje", () => {
    const lotes: LoteCompra[] = [
      { folio: "NEG-2", fecha: "2024-01-01", cantidad: 3, costoUnitario: -0.5 },
    ];

    expect(() => calcularInversionFifo(lotes, 10)).toThrow(RangeError);
    expect(() => calcularInversionFifo(lotes, 10)).toThrow(/NEG-2/);
  });
});

// ── Smoke — escenario realista de 5 lotes ─────────────────────────────────

describe("calcularInversionFifo — smoke realista", () => {
  const lotes: LoteCompra[] = [
    { folio: "A-2023", fecha: "2023-09-15", cantidad: 120, costoUnitario: 2.1 },
    { folio: "B-2024", fecha: "2024-02-10", cantidad: 80, costoUnitario: 2.5 },
    { folio: "C-2024", fecha: "2024-07-20", cantidad: 60, costoUnitario: 3.0 },
    { folio: "D-2025", fecha: "2025-01-05", cantidad: 40, costoUnitario: 3.4 },
    { folio: "E-2025", fecha: "2025-06-01", cantidad: 100, costoUnitario: 3.75 },
  ];
  const stock = 250; // corta a mitad del lote B (80 → 50)

  it("valoriza desde el lote más reciente y corta a mitad del lote B", () => {
    const r = calcularInversionFifo(lotes, stock);

    expect(r.partidas.map((p) => [p.folio, p.cantidadRemanente, p.valor])).toEqual([
      ["E-2025", 100, 375],
      ["D-2025", 40, 136],
      ["C-2024", 60, 180],
      ["B-2024", 50, 125],
      ["A-2023", 0, 0],
    ]);
    expect(r.valorTotal).toBe(816);
    expect(r.cantidadTotalCompras).toBe(400);
    expect(r.cantidadValorizada).toBe(250);
    expect(r.cantidadSinCosto).toBe(0);
    expect(r.stockActual).toBe(250);
  });

  it("cumple sum(cantidadRemanente) == min(stock, compras)", () => {
    const r = calcularInversionFifo(lotes, stock);
    const sumaRemanentes = r.partidas.reduce(
      (s, p) => s + p.cantidadRemanente,
      0
    );

    expect(sumaRemanentes).toBe(Math.min(stock, r.cantidadTotalCompras));
  });
});

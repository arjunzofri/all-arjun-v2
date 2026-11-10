/**
 * Fase B — Conciliación de compras Anil, sub-slice 1A.
 * Comparador puro: sin IO, sin DB, sin mocks.
 */

import { describe, it, expect } from "vitest";
import {
  compararCompras,
  clasificarNotaAusente,
} from "@/lib/sync/conciliacion-compras";
import type {
  LineaConciliacion,
  EstadoNotaVd,
} from "@/lib/sync/conciliacion-compras";
import type { CompraAnil } from "@/db/vidadigital/queries";

const B1 = "Bodega 1 Vida Digital";
const B2 = "Bodega 2 Vida Digital";
const DESDE = "2026-06-15";

function vd(
  folio: string,
  codigo: string,
  bodega: string,
  cantidad: number,
): CompraAnil {
  return {
    folio,
    fechanvt: null,
    fechconf: "2026-08-05",
    codigo,
    detalle: null,
    cantidad,
    cantcaja: null,
    imagenUrl: null,
    bodega,
    visaciones: [],
    precioUnitario: null,
  };
}

function app(
  folio: string,
  codigo: string,
  bodega: string,
  cantidad: number,
): LineaConciliacion {
  return { folio, codigo, bodega, cantidad };
}

function estado(parcial: Partial<EstadoNotaVd>): EstadoNotaVd {
  return {
    folio: "002515",
    existe: true,
    fechconf: "2026-08-05",
    lineasConfirmadas: 1,
    lineasValidas: 1,
    ...parcial,
  };
}

// ── 1 ────────────────────────────────────────────────────────────────────

describe("compararCompras — 1. 001986 HR-6 cuadra", () => {
  it("devuelve cuadra con contadores exactos", () => {
    const r = compararCompras(
      DESDE,
      [vd("001986", "HR-6", B1, 1000)],
      [app("001986", "HR-6", B1, 1000)],
    );

    expect(r).toEqual({
      desde: DESDE,
      cuadra: true,
      resumen: {
        notasRevisadas: 1,
        lineasVd: 1,
        lineasApp: 1,
        unidadesVd: 1000,
        unidadesApp: 1000,
        diferencias: 0,
        notasConDiferencias: 0,
      },
      diferencias: [],
    });
  });
});

// ── 2 ────────────────────────────────────────────────────────────────────

describe("compararCompras — 2. 002331 MK0-216 en dos bodegas cuadra", () => {
  it("no confunde dos líneas del mismo producto en bodegas distintas", () => {
    const r = compararCompras(
      DESDE,
      [vd("002331", "MK0-216", B1, 2), vd("002331", "MK0-216", B2, 13)],
      [app("002331", "MK0-216", B1, 2), app("002331", "MK0-216", B2, 13)],
    );

    expect(r.cuadra).toBe(true);
    expect(r.diferencias).toEqual([]);
    expect(r.resumen.lineasVd).toBe(2);
    expect(r.resumen.lineasApp).toBe(2);
    expect(r.resumen.unidadesVd).toBe(15);
    expect(r.resumen.unidadesApp).toBe(15);
    expect(r.resumen.notasRevisadas).toBe(1);
  });
});

// ── 3 ────────────────────────────────────────────────────────────────────

describe("compararCompras — 3. mismo 002331 con el bug de fix 3", () => {
  it("B1 existe en ambos lados (2 vs 15) → cantidad_distinta; B2 falta_en_app", () => {
    const r = compararCompras(
      DESDE,
      [vd("002331", "MK0-216", B1, 2), vd("002331", "MK0-216", B2, 13)],
      [app("002331", "MK0-216", B1, 15)],
    );

    expect(r.cuadra).toBe(false);
    // Regla 2.2: clave presente en ambos lados y cantidades distintas
    // → cantidad_distinta (el ejemplo de §3 lo rotulaba sobra_en_app).
    // Orden determinista: folio, codigo, bodega, tipo.
    expect(r.diferencias).toEqual([
      {
        tipo: "cantidad_distinta",
        folio: "002331",
        codigo: "MK0-216",
        bodega: B1,
        cantidadVd: 2,
        cantidadApp: 15,
      },
      {
        tipo: "falta_en_app",
        folio: "002331",
        codigo: "MK0-216",
        bodega: B2,
        cantidadVd: 13,
        cantidadApp: 0,
      },
    ]);
    expect(r.resumen).toEqual({
      notasRevisadas: 1,
      lineasVd: 2,
      lineasApp: 1,
      unidadesVd: 15,
      unidadesApp: 15,
      diferencias: 2,
      notasConDiferencias: 1,
    });
  });
});

// ── 4 ────────────────────────────────────────────────────────────────────

describe("compararCompras — 4. cantidad distinta", () => {
  it("VD 1000 / app 800 → cantidad_distinta con ambos números", () => {
    const r = compararCompras(
      DESDE,
      [vd("001986", "HR-6", B1, 1000)],
      [app("001986", "HR-6", B1, 800)],
    );

    expect(r.cuadra).toBe(false);
    expect(r.diferencias).toEqual([
      {
        tipo: "cantidad_distinta",
        folio: "001986",
        codigo: "HR-6",
        bodega: B1,
        cantidadVd: 1000,
        cantidadApp: 800,
      },
    ]);
  });
});

// ── 5 ────────────────────────────────────────────────────────────────────

describe("compararCompras — 5. nota completa ausente en VD", () => {
  const appDosLineas = [
    app("002515", "X", B1, 30),
    app("002515", "Y", B2, 5),
  ];

  it("emite 2 sobra_en_app + 1 nota_ausente_en_vd; diferencia en un solo folio", () => {
    const r = compararCompras(DESDE, [], appDosLineas);

    expect(r.diferencias.filter((d) => d.tipo === "sobra_en_app")).toHaveLength(
      2,
    );
    const nota = r.diferencias.filter(
      (d) => d.tipo === "nota_ausente_en_vd",
    );
    expect(nota).toEqual([
      {
        tipo: "nota_ausente_en_vd",
        folio: "002515",
        codigo: null,
        bodega: null,
        cantidadVd: 0,
        cantidadApp: 35,
      },
    ]);
    expect(r.resumen.diferencias).toBe(3);
    expect(r.resumen.notasConDiferencias).toBe(1);
  });

  it("con mapa de estados agrega el motivo", () => {
    const r = compararCompras(
      DESDE,
      [],
      appDosLineas,
      new Map([
        [
          "002515",
          estado({ fechconf: null, lineasConfirmadas: 0, lineasValidas: 0 }),
        ],
      ]),
    );

    expect(
      r.diferencias.find((d) => d.tipo === "nota_ausente_en_vd")?.motivo,
    ).toBe("sin_fechconf");
  });
});

// ── 6 ────────────────────────────────────────────────────────────────────

describe("clasificarNotaAusente — 6. motivos", () => {
  it("estado undefined o inexistente → no_existe_en_vd", () => {
    expect(clasificarNotaAusente(undefined, DESDE)).toBe("no_existe_en_vd");
    expect(
      clasificarNotaAusente(estado({ existe: false }), DESDE),
    ).toBe("no_existe_en_vd");
  });

  it("existe con fechconf null → sin_fechconf", () => {
    expect(
      clasificarNotaAusente(
        estado({ fechconf: null, lineasConfirmadas: 0, lineasValidas: 0 }),
        DESDE,
      ),
    ).toBe("sin_fechconf");
  });

  it("confirmada pero sin líneas pestadot='3' → sin_lineas_confirmadas", () => {
    expect(
      clasificarNotaAusente(
        estado({ lineasConfirmadas: 0, lineasValidas: 0 }),
        DESDE,
      ),
    ).toBe("sin_lineas_confirmadas");
  });

  it("líneas válidas con fechconf anterior a desde → fuera_de_desde", () => {
    expect(
      clasificarNotaAusente(estado({ fechconf: "2026-01-01" }), DESDE),
    ).toBe("fuera_de_desde");
  });

  it("líneas válidas con fechconf >= desde → producto_sin_metadata", () => {
    expect(
      clasificarNotaAusente(estado({ fechconf: DESDE }), DESDE),
    ).toBe("producto_sin_metadata");
  });

  it("confirmada pero sin líneas válidas por tipomovi/cliente → no_cumple_regla_vd", () => {
    expect(
      clasificarNotaAusente(
        estado({ lineasConfirmadas: 3, lineasValidas: 0 }),
        DESDE,
      ),
    ).toBe("no_cumple_regla_vd");
  });
});

// ── 7 ────────────────────────────────────────────────────────────────────

describe("compararCompras — 7. duplicados de entrada", () => {
  it("agrega la misma clave dos veces y cuenta una sola línea", () => {
    const r = compararCompras(
      DESDE,
      [vd("001986", "HR-6", B1, 400), vd("001986", "HR-6", B1, 600)],
      [app("001986", "HR-6", B1, 1000)],
    );

    expect(r.cuadra).toBe(true);
    expect(r.resumen.lineasVd).toBe(1);
    expect(r.resumen.unidadesVd).toBe(1000);
  });
});

// ── 8 ────────────────────────────────────────────────────────────────────

describe("compararCompras — 8. ceros a la izquierda", () => {
  it('"0089" y "89" son códigos distintos, no se normalizan', () => {
    const r = compararCompras(
      DESDE,
      [vd("001986", "0089", B1, 10)],
      [app("001986", "89", B1, 10)],
    );

    expect(r.cuadra).toBe(false);
    expect(r.diferencias).toEqual([
      {
        tipo: "falta_en_app",
        folio: "001986",
        codigo: "0089",
        bodega: B1,
        cantidadVd: 10,
        cantidadApp: 0,
      },
      {
        tipo: "sobra_en_app",
        folio: "001986",
        codigo: "89",
        bodega: B1,
        cantidadVd: 0,
        cantidadApp: 10,
      },
    ]);
  });
});

// ── 9 ────────────────────────────────────────────────────────────────────

describe("compararCompras — 9. ajuste que deja neto 0", () => {
  it("la línea existe con cantidad 0 → cantidad_distinta contra VD 10", () => {
    const r = compararCompras(
      DESDE,
      [vd("001986", "HR-6", B1, 10)],
      [app("001986", "HR-6", B1, 0)],
    );

    expect(r.diferencias).toEqual([
      {
        tipo: "cantidad_distinta",
        folio: "001986",
        codigo: "HR-6",
        bodega: B1,
        cantidadVd: 10,
        cantidadApp: 0,
      },
    ]);
  });
});

// ── 10 ───────────────────────────────────────────────────────────────────

describe("compararCompras — 10. orden determinista", () => {
  it("ordena por folio, codigo, bodega, tipo", () => {
    const r = compararCompras(
      DESDE,
      [vd("002000", "B", B1, 1), vd("001000", "Z", B1, 1)],
      [
        app("002000", "A", B1, 1),
        app("002000", "B", B1, 2),
        app("001000", "A", B1, 1),
      ],
    );

    expect(r.diferencias.map((d) => [d.folio, d.codigo, d.tipo])).toEqual([
      ["001000", "A", "sobra_en_app"],
      ["001000", "Z", "falta_en_app"],
      ["002000", "A", "sobra_en_app"],
      ["002000", "B", "cantidad_distinta"],
    ]);
  });
});

// ── 11 ───────────────────────────────────────────────────────────────────

describe("compararCompras — 11. listas vacías", () => {
  it("cuadra con todo en cero", () => {
    const r = compararCompras(DESDE, [], []);

    expect(r).toEqual({
      desde: DESDE,
      cuadra: true,
      resumen: {
        notasRevisadas: 0,
        lineasVd: 0,
        lineasApp: 0,
        unidadesVd: 0,
        unidadesApp: 0,
        diferencias: 0,
        notasConDiferencias: 0,
      },
      diferencias: [],
    });
  });
});

// ── 12 ───────────────────────────────────────────────────────────────────

describe("compararCompras — 12. totales iguales no implican cuadre", () => {
  it("unidadesApp === unidadesVd con cuadra=false (distribución por bodega)", () => {
    const r = compararCompras(
      DESDE,
      [vd("002331", "MK0-216", B1, 2), vd("002331", "MK0-216", B2, 13)],
      [app("002331", "MK0-216", B1, 15)],
    );

    expect(r.resumen.unidadesApp).toBe(r.resumen.unidadesVd);
    expect(r.cuadra).toBe(false);
  });
});

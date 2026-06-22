import { describe, it, expect } from "vitest";
import { resolverOrigenDestino } from "@/lib/utils/movimiento-ubicacion";

// ── Entrada ───────────────────────────────────────────────────────────────

describe("resolverOrigenDestino — entrada", () => {
  it("origen es null, destino es la bodega", () => {
    const r = resolverOrigenDestino({
      tipo: "entrada",
      bodegaOrigenId: 7,
      moduloDestinoId: null,
    });

    expect(r.origen).toBeNull();
    expect(r.destino).toEqual({ tipo: "bodega", id: 7 });
  });

  it("ignora moduloDestinoId aunque venga populado (defensivo)", () => {
    const r = resolverOrigenDestino({
      tipo: "entrada",
      bodegaOrigenId: 3,
      moduloDestinoId: 99, // no debería venir, pero si viene se ignora
    });

    expect(r.origen).toBeNull();
    expect(r.destino).toEqual({ tipo: "bodega", id: 3 });
  });
});

// ── Salida ────────────────────────────────────────────────────────────────

describe("resolverOrigenDestino — salida", () => {
  it("origen es bodega, destino es módulo", () => {
    const r = resolverOrigenDestino({
      tipo: "salida",
      bodegaOrigenId: 1,
      moduloDestinoId: 2,
    });

    expect(r.origen).toEqual({ tipo: "bodega", id: 1 });
    expect(r.destino).toEqual({ tipo: "modulo", id: 2 });
  });
});

// ── Retorno (inversión semántica a propósito) ─────────────────────────────

describe("resolverOrigenDestino — retorno", () => {
  it("origen es módulo (desde moduloDestinoId), destino es bodega (desde bodegaOrigenId)", () => {
    // La tabla movimientos guarda bodega_origen_id = bodega_destino
    // y modulo_destino_id = modulo_origen. Esta función invierte
    // a propósito para que origen/destino tengan semántica correcta.
    const r = resolverOrigenDestino({
      tipo: "retorno",
      bodegaOrigenId: 5, // en la fila de retorno, esto es realmente el destino
      moduloDestinoId: 3, // en la fila de retorno, esto es realmente el origen
    });

    expect(r.origen).toEqual({ tipo: "modulo", id: 3 });
    expect(r.destino).toEqual({ tipo: "bodega", id: 5 });
  });
});

// ── Tipo desconocido ──────────────────────────────────────────────────────

describe("resolverOrigenDestino — tipo desconocido", () => {
  it("lanza error para tipo no reconocido (defensa ante futuro 'ajuste')", () => {
    expect(() =>
      resolverOrigenDestino({
        tipo: "ajuste" as any,
        bodegaOrigenId: 1,
        moduloDestinoId: 2,
      })
    ).toThrow(/tipo.*desconocido/i);
  });
});

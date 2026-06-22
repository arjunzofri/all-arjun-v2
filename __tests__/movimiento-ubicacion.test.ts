import { describe, it, expect } from "vitest";
import { resolverOrigenDestino } from "@/lib/utils/movimiento-ubicacion";

// ── Entrada ───────────────────────────────────────────────────────────────

describe("resolverOrigenDestino — entrada", () => {
  it("origen es null, destino es la bodega", () => {
    const r = resolverOrigenDestino({
      tipo: "entrada",
      bodegaOrigenId: 7,
      moduloDestinoId: null,
      cantidad: 5, // no usada por entrada, solo para firma nueva
    });

    expect(r.origen).toBeNull();
    expect(r.destino).toEqual({ tipo: "bodega", id: 7 });
  });

  it("ignora moduloDestinoId aunque venga populado (defensivo)", () => {
    const r = resolverOrigenDestino({
      tipo: "entrada",
      bodegaOrigenId: 3,
      moduloDestinoId: 99,
      cantidad: 1,
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
      cantidad: 10,
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
      cantidad: 3,
    });

    expect(r.origen).toEqual({ tipo: "modulo", id: 3 });
    expect(r.destino).toEqual({ tipo: "bodega", id: 5 });
  });
});

// ── Tipo desconocido ──────────────────────────────────────────────────────

describe("resolverOrigenDestino — tipo desconocido", () => {
  it("lanza error para tipo no reconocido", () => {
    expect(() =>
      resolverOrigenDestino({
        tipo: "transferencia" as any,
        bodegaOrigenId: 1,
        moduloDestinoId: 2,
        cantidad: 1,
      })
    ).toThrow(/tipo.*desconocido/i);
  });
});

// ── Ajuste (dirección por signo de cantidad) ──────────────────────────────

describe("resolverOrigenDestino — ajuste", () => {
  it("cantidad positiva → origen bodega, destino módulo (llegó más de lo registrado)", () => {
    const r = resolverOrigenDestino({
      tipo: "ajuste",
      bodegaOrigenId: 2,
      moduloDestinoId: 8,
      cantidad: 4,
    });

    expect(r.origen).toEqual({ tipo: "bodega", id: 2 });
    expect(r.destino).toEqual({ tipo: "modulo", id: 8 });
  });

  it("cantidad negativa → origen módulo, destino bodega (llegó menos, se devuelve la diferencia)", () => {
    const r = resolverOrigenDestino({
      tipo: "ajuste",
      bodegaOrigenId: 2,
      moduloDestinoId: 8,
      cantidad: -3,
    });

    expect(r.origen).toEqual({ tipo: "modulo", id: 8 });
    expect(r.destino).toEqual({ tipo: "bodega", id: 2 });
  });

  it("cantidad === 0 → origen y destino null (sin movimiento real; prevención en crearAjuste)", () => {
    // Un ajuste de cantidad 0 no representa movimiento real. La responsabilidad
    // de prevenir que esto ocurra es de crearAjuste (Zod), no de esta función.
    // Si aun así llega, devolvemos null en ambas puntas — documentado, explícito,
    // no un comportamiento accidental de caer en una rama equivocada.
    const r = resolverOrigenDestino({
      tipo: "ajuste",
      bodegaOrigenId: 2,
      moduloDestinoId: 8,
      cantidad: 0,
    });

    expect(r.origen).toBeNull();
    expect(r.destino).toBeNull();
  });
});

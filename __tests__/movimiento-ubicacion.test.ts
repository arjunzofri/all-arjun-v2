import { describe, it, expect } from "vitest";
import {
  resolverOrigenDestino,
  efectoSobreUbicacion,
  calcularCantidadNeta,
  calcularCantidadAjuste,
} from "@/lib/utils/movimiento-ubicacion";
import type { Ubicacion } from "@/lib/utils/movimiento-ubicacion";

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

// ── efectoSobreUbicacion + calcularCantidadNeta ───────────────────────────

const BODEGA_1: Ubicacion = { tipo: "bodega", id: 1 };
const MODULO_2: Ubicacion = { tipo: "modulo", id: 2 };
const BODEGA_5: Ubicacion = { tipo: "bodega", id: 5 };
const MODULO_3: Ubicacion = { tipo: "modulo", id: 3 };

describe("calcularCantidadNeta", () => {
  // ── Salida (bodega 1 → módulo 2), perspectiva del módulo destino ──────

  it("salida original 20, sin ajustes → neto 20 para el módulo", () => {
    const neto = calcularCantidadNeta(
      { tipo: "salida", bodegaOrigenId: 1, moduloDestinoId: 2, cantidad: 20 },
      [],
      MODULO_2,
    );
    expect(neto).toBe(20);
  });

  it("salida original 20, ajuste -2 (llegó menos) → neto 18 para el módulo", () => {
    // cantidad=-2: módulo→bodega, se devuelve la diferencia al origen
    const neto = calcularCantidadNeta(
      { tipo: "salida", bodegaOrigenId: 1, moduloDestinoId: 2, cantidad: 20 },
      [
        { tipo: "ajuste", bodegaOrigenId: 1, moduloDestinoId: 2, cantidad: -2 },
      ],
      MODULO_2,
    );
    expect(neto).toBe(18);
  });

  it("salida original 20, ajustes -2 y +1 → neto 19 para el módulo", () => {
    const neto = calcularCantidadNeta(
      { tipo: "salida", bodegaOrigenId: 1, moduloDestinoId: 2, cantidad: 20 },
      [
        { tipo: "ajuste", bodegaOrigenId: 1, moduloDestinoId: 2, cantidad: -2 },
        { tipo: "ajuste", bodegaOrigenId: 1, moduloDestinoId: 2, cantidad: +1 },
      ],
      MODULO_2,
    );
    expect(neto).toBe(19);
  });

  // ── Retorno (módulo 3 → bodega 5), perspectiva de la bodega destino ───

  it("retorno original 10, sin ajustes → neto 10 para la bodega", () => {
    const neto = calcularCantidadNeta(
      { tipo: "retorno", bodegaOrigenId: 5, moduloDestinoId: 3, cantidad: 10 },
      [],
      BODEGA_5,
    );
    expect(neto).toBe(10);
  });

  it("retorno original 10, ajuste +2 (llegaron 8, se devuelven 2 de bodega a módulo) → neto 8 para la bodega", () => {
    // cantidad=+2: bodega→módulo. El signo es positivo porque el ajuste
    // mueve stock de bodega a módulo según la convención de signo.
    // Para la bodega, este ajuste es una salida → efecto negativo.
    const neto = calcularCantidadNeta(
      { tipo: "retorno", bodegaOrigenId: 5, moduloDestinoId: 3, cantidad: 10 },
      [
        { tipo: "ajuste", bodegaOrigenId: 5, moduloDestinoId: 3, cantidad: +2 },
      ],
      BODEGA_5,
    );
    expect(neto).toBe(8);
  });
});

// ── calcularCantidadAjuste ────────────────────────────────────────────────

const DESTINO_MODULO: Ubicacion = { tipo: "modulo", id: 2 };
const DESTINO_BODEGA: Ubicacion = { tipo: "bodega", id: 5 };

describe("calcularCantidadAjuste", () => {
  // ── Destino módulo (caso salida) ─────────────────────────────────

  it("destino módulo, neta=20, real=18 → devuelve -2", () => {
    const cantidad = calcularCantidadAjuste(DESTINO_MODULO, 20, 18);
    expect(cantidad).toBe(-2);
  });

  it("destino módulo, neta=18, real=19 (segunda corrección) → devuelve +1", () => {
    const cantidad = calcularCantidadAjuste(DESTINO_MODULO, 18, 19);
    expect(cantidad).toBe(+1);
  });

  // ── Destino bodega (caso retorno, signo invertido) ───────────────

  it("destino bodega, neta=10, real=8 → devuelve +2 (signo invertido)", () => {
    const cantidad = calcularCantidadAjuste(DESTINO_BODEGA, 10, 8);
    expect(cantidad).toBe(+2);
  });

  it("destino bodega, neta=8, real=8 → lanza error (sin diferencia)", () => {
    expect(() =>
      calcularCantidadAjuste(DESTINO_BODEGA, 8, 8)
    ).toThrow(/diferencia|coincide/i);
  });

  // ── Círculo completo ─────────────────────────────────────────────

  it("el ajuste producido por calcularCantidadAjuste, al aplicarse via calcularCantidadNeta, da la cantidad real", () => {
    // Salida original 20 al módulo 2, llegaron 18.
    const cantidadAjuste = calcularCantidadAjuste(
      { tipo: "modulo", id: 2 },
      20,
      18,
    );
    expect(cantidadAjuste).toBe(-2);

    const ajusteInput = {
      tipo: "ajuste" as const,
      bodegaOrigenId: 1,
      moduloDestinoId: 2,
      cantidad: cantidadAjuste,
    };

    const neto = calcularCantidadNeta(
      { tipo: "salida", bodegaOrigenId: 1, moduloDestinoId: 2, cantidad: 20 },
      [ajusteInput],
      { tipo: "modulo", id: 2 },
    );

    expect(neto).toBe(18);
  });
});

/**
 * Fase B — Sub-slice 5a: AjusteModal (funciones puras)
 *
 * Riesgos cubiertos:
 *  R1-R3.  resolverSeleccionInicial: vacío / uno / varios
 *  R4-R9.  parseCantidadReal: válido positivo, válido cero, vacío,
 *          negativo, no numérico, decimal
 *  R10-R13. createAjusteSubmitHandler: éxito, error, doble-submit,
 *          setPending en ambos caminos
 */

import { describe, it, expect, vi } from "vitest";

// ── Import de funciones que NO existen todavía (Fase B) ──────────────
import {
  resolverSeleccionInicial,
  parseCantidadReal,
  createAjusteSubmitHandler,
} from "@/components/AjusteModal";

// ── resolverSeleccionInicial ─────────────────────────────────────────

describe("resolverSeleccionInicial", () => {
  it("lista vacía → null", () => {
    expect(resolverSeleccionInicial([])).toBeNull();
  });

  it("un solo elemento → preselecciona su id", () => {
    expect(
      resolverSeleccionInicial([
        { movimientoId: 42, tipo: "salida", cantidadOriginal: 20, cantidadNeta: 18, createdAt: new Date() },
      ])
    ).toBe(42);
  });

  it("varios elementos → null (requiere selección manual)", () => {
    expect(
      resolverSeleccionInicial([
        { movimientoId: 1, tipo: "salida", cantidadOriginal: 20, cantidadNeta: 18, createdAt: new Date() },
        { movimientoId: 2, tipo: "retorno", cantidadOriginal: 10, cantidadNeta: 8, createdAt: new Date() },
      ])
    ).toBeNull();
  });
});

// ── parseCantidadReal ────────────────────────────────────────────────

describe("parseCantidadReal", () => {
  it('"18" → válido, valor 18', () => {
    const r = parseCantidadReal("18");
    expect(r.valido).toBe(true);
    if (r.valido) expect(r.valor).toBe(18);
  });

  it('"0" → válido, valor 0 (el servidor lo acepta)', () => {
    const r = parseCantidadReal("0");
    expect(r.valido).toBe(true);
    if (r.valido) expect(r.valor).toBe(0);
  });

  it('"" → inválido, mensaje descriptivo', () => {
    const r = parseCantidadReal("");
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.error).toMatch(/ingres|vacío|requerido|cantidad/i);
  });

  it('"-1" → inválido, no se permiten negativos', () => {
    const r = parseCantidadReal("-1");
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.error).toMatch(/negativ/i);
  });

  it('"abc" → inválido, no es un número', () => {
    const r = parseCantidadReal("abc");
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.error).toMatch(/número|entero|inválido/i);
  });

  it('"1.5" → inválido, debe ser entero', () => {
    const r = parseCantidadReal("1.5");
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.error).toMatch(/entero|decimal/i);
  });
});

// ── createAjusteSubmitHandler ────────────────────────────────────────

describe("createAjusteSubmitHandler", () => {
  it("éxito: llama onExito, no llama onError", async () => {
    const onExito = vi.fn();
    const onError = vi.fn();
    let pending = false;

    const handler = createAjusteSubmitHandler({
      crearAjusteFn: async () => ({ movimientoId: 99, ok: true }),
      getInput: () => ({ movimientoOriginalId: 1, cantidadReal: 18, idempotencyKey: "k", usuarioId: 1 }),
      isPending: () => pending,
      setPending: (v: boolean) => { pending = v; },
      onExito,
      onError,
    });

    await handler();

    expect(onExito).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("error: llama onError con el mensaje, no llama onExito", async () => {
    const onExito = vi.fn();
    const onError = vi.fn();
    let pending = false;

    const handler = createAjusteSubmitHandler({
      crearAjusteFn: async () => { throw new Error("Stock insuficiente"); },
      getInput: () => ({ movimientoOriginalId: 1, cantidadReal: 99, idempotencyKey: "k2", usuarioId: 1 }),
      isPending: () => pending,
      setPending: (v: boolean) => { pending = v; },
      onExito,
      onError,
    });

    await handler();

    expect(onError).toHaveBeenCalledWith("Stock insuficiente");
    expect(onExito).not.toHaveBeenCalled();
  });

  it("doble-submit: si isPending es true, crearAjusteFn no se llama", () => {
    const crearAjusteFn = vi.fn();
    let pending = true; // ya está pendiente

    const handler = createAjusteSubmitHandler({
      crearAjusteFn,
      getInput: () => ({ movimientoOriginalId: 1, cantidadReal: 18, idempotencyKey: "k3", usuarioId: 1 }),
      isPending: () => pending,
      setPending: () => {},
      onExito: () => {},
      onError: () => {},
    });

    handler();

    expect(crearAjusteFn).not.toHaveBeenCalled();
  });

  it("setPending: se activa al empezar y se desactiva al terminar (éxito y error)", async () => {
    const log: boolean[] = [];

    const handlerExito = createAjusteSubmitHandler({
      crearAjusteFn: async () => ({ movimientoId: 1, ok: true }),
      getInput: () => ({ movimientoOriginalId: 1, cantidadReal: 1, idempotencyKey: "k4a", usuarioId: 1 }),
      isPending: () => false,
      setPending: (v: boolean) => log.push(v),
      onExito: () => {},
      onError: () => {},
    });

    await handlerExito();
    // éxito: true → false
    expect(log[0]).toBe(true);
    expect(log[log.length - 1]).toBe(false);

    const logErr: boolean[] = [];
    const handlerError = createAjusteSubmitHandler({
      crearAjusteFn: async () => { throw new Error("fail"); },
      getInput: () => ({ movimientoOriginalId: 1, cantidadReal: 1, idempotencyKey: "k4b", usuarioId: 1 }),
      isPending: () => false,
      setPending: (v: boolean) => logErr.push(v),
      onExito: () => {},
      onError: () => {},
    });

    await handlerError();
    // error: true → false
    expect(logErr[0]).toBe(true);
    expect(logErr[logErr.length - 1]).toBe(false);
  });
});

/**
 * Fase B — Slice A (2/2): Botón de sync manual en /productos
 *
 * Riesgos:
 *  R1. Éxito → onResult con el valor de syncFn, onError no se llama
 *  R2. Error → onError con mensaje, onResult no se llama
 *  R3. Doble-click con isPending=true → syncFn se llama una sola vez
 *  R4. setPending true→false en ambos caminos
 */

import { describe, it, expect, vi } from "vitest";

// ── Import de la función que NO existe todavía (Fase B) ──────────────
import {
  createSyncHandler,
  formatearConciliacion,
} from "@/app/(dashboard)/productos/page";

// ── Éxito ───────────────────────────────────────────────────────────────

describe("createSyncHandler", () => {
  it("éxito: llama onResult con el valor, no llama onError", async () => {
    const onResult = vi.fn();
    const onError = vi.fn();
    let pending = false;

    const handler = createSyncHandler({
      syncFn: async () => ({ procesadas: 15, watermark: "2026-06-20" }),
      isPending: () => pending,
      setPending: (v: boolean) => { pending = v; },
      onResult,
      onError,
    });

    await handler();

    expect(onResult).toHaveBeenCalledWith({
      procesadas: 15,
      watermark: "2026-06-20",
    });
    expect(onError).not.toHaveBeenCalled();
  });

  // ── Error ────────────────────────────────────────────────────────────

  it("error: llama onError con el mensaje, no llama onResult", async () => {
    const onResult = vi.fn();
    const onError = vi.fn();
    let pending = false;

    const handler = createSyncHandler({
      syncFn: async () => { throw new Error("Red caída"); },
      isPending: () => pending,
      setPending: (v: boolean) => { pending = v; },
      onResult,
      onError,
    });

    await handler();

    expect(onError).toHaveBeenCalledWith("Red caída");
    expect(onResult).not.toHaveBeenCalled();
  });

  // ── Doble-click ──────────────────────────────────────────────────────

  it("doble-click: si isPending es true, syncFn no se llama", () => {
    const syncFn = vi.fn();
    let pending = true;

    const handler = createSyncHandler({
      syncFn,
      isPending: () => pending,
      setPending: () => {},
      onResult: () => {},
      onError: () => {},
    });

    handler();

    expect(syncFn).not.toHaveBeenCalled();
  });

  // ── setPending en ambos caminos ─────────────────────────────────────

  it("setPending: true→false en éxito y en error", async () => {
    const log: boolean[] = [];

    // Éxito
    const hOk = createSyncHandler({
      syncFn: async () => ({ procesadas: 1, watermark: "x" }),
      isPending: () => false,
      setPending: (v: boolean) => log.push(v),
      onResult: () => {},
      onError: () => {},
    });
    await hOk();
    expect(log[0]).toBe(true);
    expect(log[log.length - 1]).toBe(false);

    // Error
    const logErr: boolean[] = [];
    const hErr = createSyncHandler({
      syncFn: async () => { throw new Error("fail"); },
      isPending: () => false,
      setPending: (v: boolean) => logErr.push(v),
      onResult: () => {},
      onError: () => {},
    });
    await hErr();
    expect(logErr[0]).toBe(true);
    expect(logErr[logErr.length - 1]).toBe(false);
  });
});

// ── 32-33: conciliación en el resultado del sync ─────────────────────────

function resultado(over: Record<string, unknown> = {}) {
  return {
    desde: "2026-07-01",
    cuadra: true,
    resumen: {
      notasRevisadas: 3,
      lineasVd: 4,
      lineasApp: 4,
      unidadesVd: 20,
      unidadesApp: 20,
      diferencias: 0,
      notasConDiferencias: 0,
    },
    diferencias: [],
    ...over,
  };
}

describe("formatearConciliacion", () => {
  it("32a: undefined → null", () => {
    expect(formatearConciliacion(undefined)).toBeNull();
  });

  it("32b: {error} → tono error", () => {
    const r = formatearConciliacion({ error: "VD caída" });
    expect(r?.tono).toBe("error");
    expect(r?.texto).toContain("Conciliación falló: VD caída");
  });

  it("32c: cuadra → tono ok", () => {
    const r = formatearConciliacion(resultado());
    expect(r?.tono).toBe("ok");
    expect(r?.texto).toBe("Conciliación OK: 3 notas, 4 líneas, 20 u.");
  });

  it("32d: con diferencias → tono alerta", () => {
    const r = formatearConciliacion(
      resultado({
        cuadra: false,
        resumen: {
          notasRevisadas: 3,
          lineasVd: 4,
          lineasApp: 4,
          unidadesVd: 20,
          unidadesApp: 15,
          diferencias: 2,
          notasConDiferencias: 1,
        },
        diferencias: [
          {
            tipo: "falta_en_app",
            folio: "002331",
            codigo: "MK0-216",
            bodega: "Bodega 2 Vida Digital",
            cantidadVd: 5,
            cantidadApp: 0,
          },
        ],
      }),
    );
    expect(r?.tono).toBe("alerta");
    expect(r?.texto).toBe(
      "Conciliación: 2 diferencias en 1 notas (app 15 u. vs VD 20 u.)",
    );
  });
});

describe("createSyncHandler — conciliación", () => {
  it("33: propaga el resultado con conciliacion sin cambios", async () => {
    const onResult = vi.fn();
    const conConciliacion = {
      procesadas: 5,
      watermark: "2026-08-01",
      conciliacion: resultado(),
    };

    const handler = createSyncHandler({
      syncFn: async () => conConciliacion,
      isPending: () => false,
      setPending: () => {},
      onResult,
      onError: () => {},
    });

    await handler();

    expect(onResult).toHaveBeenCalledWith(conConciliacion);
    expect(onResult.mock.calls[0][0].conciliacion).toEqual(resultado());
  });
});

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
import { createSyncHandler } from "@/app/(dashboard)/productos/page";

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

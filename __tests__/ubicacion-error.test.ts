/**
 * Fase B — Error handling en cargar(): Tests que intentan romper el slice.
 *
 * Riesgos:
 * 1. getStockPorUbicacion lanza → loading perpetuo (setLoading(false) nunca corre).
 * 2. Error en "Cargar más" borra items ya cargados.
 * 3. Error previo no se limpia tras éxito.
 * 4. finally cubre tanto throw síncrono como rechazo de promesa.
 *
 * Sin jsdom → se testea executeLoad(), función pura exportada desde el componente.
 *
 * AHORA EN ROJO: UbicacionDetalle.tsx actual no exporta executeLoad.
 */

import { describe, it, expect, vi } from "vitest";

// ── RED: el componente actual no exporta executeLoad ──
let executeLoad: any = null;
try {
  executeLoad = (await import("@/app/(dashboard)/components/UbicacionDetalle")).executeLoad;
} catch {
  // Esperado en Fase B — export no existe
}

type Item = { id: number; codigo: string; detalle: string | null; packing: number | null; cantidad: number };
type Page = { items: Item[]; nextCursor: number | null };

describe("UbicacionDetalle — error handling", () => {
  // ── Contrato de existencia ────────────────────────────────────────
  it("el componente exporta executeLoad", () => {
    expect(executeLoad).not.toBeNull();
    expect(typeof executeLoad).toBe("function");
  });

  // ── R1: Error en carga inicial (reset=true) ───────────────────────
  it("reset=true: onError llamado, onSuccess NO llamado, onSettled SI llamado", async () => {
    const load = vi.fn().mockRejectedValue(new Error("DB down"));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();

    await executeLoad({
      load,
      reset: true,
      onSuccess,
      onError,
      onSettled,
    });

    expect(load).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe("DB down");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  // ── R2: Error en "Cargar más" (reset=false) ───────────────────────
  it("reset=false: onError llamado, onSuccess NO llamado, items preservados", async () => {
    const load = vi.fn().mockRejectedValue(new Error("timeout"));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();

    await executeLoad({
      load,
      reset: false,
      onSuccess,
      onError,
      onSettled,
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe("timeout");
    // onSuccess nunca se llama → quien implementa el append en el componente
    // (setItems(prev => [...prev, ...page.items])) nunca corre → items preservados
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  // ── R3: Éxito limpia error previo ─────────────────────────────────
  it("load exitoso llama onSuccess, no llama onError, llama onSettled", async () => {
    const page: Page = {
      items: [{ id: 1, codigo: "A", detalle: "Alpha", packing: null, cantidad: 5 }],
      nextCursor: null,
    };
    const load = vi.fn().mockResolvedValue(page);
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();

    await executeLoad({
      load,
      reset: true,
      onSuccess,
      onError,
      onSettled,
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(page, true);
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  // ── R4: onSettled corre incluso si load lanza sincrónicamente ─────
  it("onSettled se ejecuta aunque load lance antes de retornar promesa", async () => {
    // Escenario: server action lanza por error de serialización antes de
    // devolver la promesa real (network error, parámetro inválido, etc.)
    const load = vi.fn().mockImplementation(() => {
      throw new Error("sync error");
    });
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();

    await executeLoad({
      load,
      reset: true,
      onSuccess,
      onError,
      onSettled,
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe("sync error");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});

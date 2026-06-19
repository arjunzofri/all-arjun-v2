/**
 * Fase D — Botón de Logout: Test del handler real vs doble-submit.
 *
 * Importa createLogoutHandler del componente y lo somete a
 * doble invocación con signOut mockeado. Sin jsdom, sin string-match,
 * sin duplicación inline de lógica.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogoutHandler } from "@/components/LogoutButton";

describe("LogoutButton", () => {
  let pendingFlag: boolean;
  const isPending = () => pendingFlag;
  const setPending = (v: boolean) => {
    pendingFlag = v;
  };

  const mockSignOut = vi.fn<(_opts?: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined);

  beforeEach(() => {
    pendingFlag = false;
    mockSignOut.mockClear();
  });

  it("el componente exporta createLogoutHandler", () => {
    expect(createLogoutHandler).toBeDefined();
    expect(typeof createLogoutHandler).toBe("function");
  });

  // ── Doble-submit: el segundo click (antes de que el primero resuelva) es no-op ──
  it("llama signOut una sola vez con dos invocaciones rápidas", async () => {
    await Promise.all([
      createLogoutHandler(mockSignOut, isPending, setPending),
      createLogoutHandler(mockSignOut, isPending, setPending),
    ]);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });

  // ── Después de completar, permite otro logout ─────────────────────
  it("permite un segundo logout después de que el primero termina", async () => {
    await createLogoutHandler(mockSignOut, isPending, setPending);
    expect(mockSignOut).toHaveBeenCalledTimes(1);

    // setPending(false) ya fue llamado en el finally del primero
    await createLogoutHandler(mockSignOut, isPending, setPending);
    expect(mockSignOut).toHaveBeenCalledTimes(2);
  });

  // ── setPending se llama correctamente ─────────────────────────────
  it("pone pending a true mientras signOut está en vuelo", async () => {
    let resolveSignOut: () => void;
    const deferred = new Promise<void>((r) => {
      resolveSignOut = r;
    });
    const slowSignOut = vi.fn().mockReturnValue(deferred);

    const promise = createLogoutHandler(slowSignOut, isPending, setPending);

    // pending debe estar a true inmediatamente después de invocar
    expect(pendingFlag).toBe(true);

    resolveSignOut!();
    await promise;

    // pending vuelve a false tras resolver
    expect(pendingFlag).toBe(false);
  });
});

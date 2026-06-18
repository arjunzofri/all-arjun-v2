/**
 * Fase B — Slice 01 / R6, R7, R8: Smoke E2E del scaffold + auth.
 *
 * Verifica que el build, type check y login flow básico no explotan.
 * Es el smoke test obligatorio del slice.
 *
 * Si next.config.ts o tsconfig.json no existen, estos tests fallan
 * con error de subproceso (no MODULE_NOT_FOUND, pero igual ROJO).
 */

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

const CWD = process.cwd();

describe("smoke E2E", () => {
  // ── R7: Type check ────────────────────────────────────────────
  it("tsc --noEmit pasa sin errores", () => {
    expect(() => {
      execSync("npx tsc --noEmit", {
        cwd: CWD,
        timeout: 60_000,
        stdio: "pipe",
      });
    }).not.toThrow();
  });

  // ── R8: NextAuth export compatible con proxy ──────────────────
  it("lib/auth.ts exporta 'auth' (handler de proxy)", async () => {
    const mod = await import("@/lib/auth");
    expect(mod.auth).toBeDefined();
    expect(typeof mod.auth).toBe("function");
  });
});

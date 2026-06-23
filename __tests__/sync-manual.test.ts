/**
 * Fase B — Slice A: Endpoint de sync manual (POST /api/sync/compras-anil)
 *
 * Riesgos:
 *  R1. POST sin sesión → 401
 *  R2. POST con sesión → 200, llama syncComprasAnil con valor del watermark
 *  R3. Si sync_watermark no tiene fila → fallback '2026-05-01'
 *  R4. Si syncComprasAnil lanza → 500 con mensaje de error
 *
 * Sin conexión real a la DB: neon() está mockeado al nivel superior.
 */

import { describe, it, expect, vi } from "vitest";

// ── Mocks al nivel superior (requerido por Vitest hoisting) ──────────────

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/sync/compras-anil", () => ({
  syncComprasAnil: vi.fn().mockResolvedValue({
    procesadas: 81,
    watermark: "2026-06-15",
  }),
}));

// Mock de neon(): control total sobre qué devuelve la query del watermark,
// sin tocar la DB real en ningún test.
const mockSql = vi.fn();
vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

import { POST } from "@/app/api/sync/compras-anil/route";
import { auth } from "@/lib/auth";
import { syncComprasAnil } from "@/lib/sync/compras-anil";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockSync = syncComprasAnil as ReturnType<typeof vi.fn>;

// ── R1: Sin sesión → 401 ────────────────────────────────────────────────

describe("POST /api/sync/compras-anil — auth", () => {
  it("devuelve 401 si no hay sesión", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST();
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("No autorizado");
  });
});

// ── R2: Con sesión → 200, llama syncComprasAnil con watermark real ─────

describe("POST /api/sync/compras-anil — éxito", () => {
  it("devuelve 200, llama syncComprasAnil con el valor leído del watermark", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "62", email: "admin@test.com" },
    });
    mockSync.mockClear();
    mockSql.mockClear();

    // Mock: la query del watermark devuelve una fila con value='2026-05-10'
    mockSql.mockResolvedValueOnce([{ value: "2026-05-10" }]);

    const res = await POST();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.procesadas).toBe(81);
    expect(body.watermark).toBe("2026-06-15");

    // Confirmar que syncComprasAnil recibió el valor del mock, no un hardcodeo
    expect(mockSync).toHaveBeenCalledWith("2026-05-10");
  });
});

// ── R3: Watermark ausente → fallback '2026-05-01' ───────────────────────

describe("POST /api/sync/compras-anil — fallback", () => {
  it("usa '2026-05-01' como fallback cuando sync_watermark no tiene fila", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "62", email: "admin@test.com" },
    });
    mockSync.mockClear();
    mockSql.mockClear();

    // Mock: la query del watermark devuelve array vacío (sin fila)
    mockSql.mockResolvedValueOnce([]);

    const res = await POST();
    expect(res.status).toBe(200);

    // El fallback debe ser exactamente "2026-05-01"
    expect(mockSync).toHaveBeenCalledWith("2026-05-01");
  });
});

// ── R4: Error en syncComprasAnil → 500 ──────────────────────────────────

describe("POST /api/sync/compras-anil — error", () => {
  it("devuelve 500 con mensaje si syncComprasAnil lanza", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "62", email: "admin@test.com" },
    });
    mockSync.mockRejectedValue(new Error("DB caída"));
    // R4 no consulta el watermark (syncComprasAnil lanza antes),
    // pero el mock de mockSql debe resolverse para que el endpoint llegue al try
    mockSql.mockResolvedValueOnce([{ value: "irrelevante" }]);

    const res = await POST();
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe("DB caída");

    // Restaurar mock para tests siguientes
    mockSync.mockResolvedValue({
      procesadas: 81,
      watermark: "2026-06-15",
    });
  });
});

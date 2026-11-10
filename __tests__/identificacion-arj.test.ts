/**
 * Fase B — Módulo 1, Slice 9: código alternativo ARJ-.
 * Cubre formato/alfabeto, esCodigoArj, la action (colisiones, sin sesión,
 * nunca INSERT) y que /entradas con nuevo=1 no consulte el histórico.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const m = vi.hoisted(() => ({
  propiaMock: vi.fn(),
  executeMock: vi.fn(),
  neonMock: vi.fn(),
}));

vi.mock("@neondatabase/serverless", () => ({ neon: m.neonMock }));
vi.mock("@/db/vidadigital", () => ({
  getVidaDigitalClient: () => ({ execute: m.executeMock }),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import {
  formatoCodigoArj,
  sufijoAleatorio,
  esCodigoArj,
} from "@/lib/utils/codigo-alternativo";
import { generarCodigoAlternativo } from "@/lib/actions/identificacion";

const mockAuth = vi.mocked(auth);
const hoy = () => formatoCodigoArj(new Date(), "AAA");

beforeEach(() => {
  vi.clearAllMocks();
  m.neonMock.mockReturnValue(m.propiaMock);
  m.propiaMock.mockResolvedValue([]);
  m.executeMock.mockResolvedValue({ rows: [] });
  mockAuth.mockResolvedValue({ user: { id: "62" } } as never);
  vi.spyOn(Math, "random").mockReturnValue(0); // sufijo fijo AAA
});

afterEach(() => vi.restoreAllMocks());

describe("formatoCodigoArj / sufijoAleatorio", () => {
  it("arma ARJ-YYMMDD-SUFIJO", () => {
    expect(formatoCodigoArj(new Date(2026, 0, 5), "AB2")).toBe("ARJ-260105-AB2");
    expect(formatoCodigoArj(new Date(2026, 11, 31), "ZZ9")).toBe("ARJ-261231-ZZ9");
  });

  it("el sufijo es de 3 caracteres del alfabeto sin 0/O/1/I", () => {
    for (let i = 0; i < 500; i++) {
      expect(sufijoAleatorio()).toMatch(/^[A-HJ-NP-Z2-9]{3}$/);
    }
    expect(sufijoAleatorio(() => 0)).toBe("AAA");
    expect(sufijoAleatorio(() => 0.999999)).toBe("999");
  });
});

describe("esCodigoArj", () => {
  it("acepta el formato exacto y recorta espacios", () => {
    expect(esCodigoArj("ARJ-260105-AB2")).toBe(true);
    expect(esCodigoArj("  ARJ-261231-ZZ9 ")).toBe(true);
  });

  it("rechaza forma o alfabeto inválidos", () => {
    expect(esCodigoArj("arj-260105-ab2")).toBe(false);
    expect(esCodigoArj("ARJ-260105")).toBe(false);
    expect(esCodigoArj("ARJ-260105-AB")).toBe(false);
    expect(esCodigoArj("ARJ-260105-AB0")).toBe(false);
    expect(esCodigoArj("ARJ-260105-ABI")).toBe(false);
    expect(esCodigoArj("ARJ-260105-ABO")).toBe(false);
    expect(esCodigoArj("OTRO-260105-AB2")).toBe(false);
    expect(esCodigoArj("")).toBe(false);
  });
});

describe("generarCodigoAlternativo()", () => {
  it("sin sesión → error y no consulta la DB", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(generarCodigoAlternativo()).rejects.toThrow("No autenticado");
    expect(m.propiaMock).not.toHaveBeenCalled();
    expect(m.executeMock).not.toHaveBeenCalled();
  });

  it("devuelve un ARJ válido cuando no hay colisión", async () => {
    const r = await generarCodigoAlternativo();
    expect(r.codigo).toBe(hoy());
    expect(esCodigoArj(r.codigo)).toBe(true);
  });

  it("reintenta si el código ya existe en productos propia", async () => {
    m.propiaMock.mockResolvedValueOnce([{ "?column?": 1 }]).mockResolvedValue([]);
    const r = await generarCodigoAlternativo();
    expect(r.codigo).toBe(hoy());
    expect(m.propiaMock).toHaveBeenCalledTimes(2);
    expect(m.executeMock).toHaveBeenCalledTimes(1);
  });

  it("reintenta si el código ya existe en el catálogo de Vida Digital", async () => {
    m.executeMock.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }).mockResolvedValue({ rows: [] });
    const r = await generarCodigoAlternativo();
    expect(r.codigo).toBe(hoy());
    expect(m.executeMock).toHaveBeenCalledTimes(2);
  });

  it("tras 5 choques → error", async () => {
    m.propiaMock.mockResolvedValue([{ "?column?": 1 }]);
    await expect(generarCodigoAlternativo()).rejects.toThrow(/código único/);
    expect(m.propiaMock).toHaveBeenCalledTimes(5);
  });

  it("solo ejecuta SELECT (nunca INSERT/UPDATE/DELETE) contra ambas bases", async () => {
    await generarCodigoAlternativo();
    const propiaSql = String(m.propiaMock.mock.calls[0][0]);
    expect(propiaSql).toContain("SELECT");
    expect(propiaSql).not.toMatch(/INSERT|UPDATE|DELETE/i);
    const fuente = readFileSync(join(process.cwd(), "lib/actions/identificacion.ts"), "utf8");
    expect(fuente).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
  });
});

describe("entradas/page — nuevo=1 no consulta el histórico", () => {
  it("el guard de nuevo=1 retorna antes del fetch al histórico", () => {
    const src = readFileSync(
      join(process.cwd(), "app/(dashboard)/entradas/page.tsx"),
      "utf8"
    );
    const inicio = src.indexOf("Llegada desde /entradas/identificar");
    const guarda = src.indexOf('params.get("nuevo")', inicio);
    const fetchHistorico = src.indexOf(
      "buscar-historico?q=${encodeURIComponent(q)}",
      inicio
    );
    expect(guarda).toBeGreaterThan(-1);
    expect(fetchHistorico).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(fetchHistorico);
    expect(src.slice(guarda, fetchHistorico)).toContain("return");
  });
});

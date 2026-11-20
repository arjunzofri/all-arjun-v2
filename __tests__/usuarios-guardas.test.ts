/**
 * Fase B — Usuarios R8: guardas de sesión/admin en server actions.
 * Auth y DB mockeadas: estos casos nunca tocan la base real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { authMock, dbSelect, dbInsert } = vi.hoisted(() => ({
  authMock: vi.fn(),
  dbSelect: vi.fn(),
  dbInsert: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/db", () => ({ db: { select: dbSelect, insert: dbInsert } }));

import { crearUsuario, listarUsuarios } from "@/lib/actions/usuarios";

const NO_AUTORIZADO = /no autorizado/i;
const input = { username: "nuevo", password: "secreto", role: "operador" as const };

const sesion = (id: string | number, role: string) =>
  authMock.mockResolvedValue({ user: { id: String(id), role } });

beforeEach(() => {
  vi.clearAllMocks();
  dbSelect.mockReturnValue({ from: () => ({ orderBy: async () => [] }) });
});

describe("crearUsuario() — guardas", () => {
  it("rechaza sin sesión antes de tocar la DB", async () => {
    authMock.mockResolvedValue(null);
    await expect(crearUsuario(input)).rejects.toThrow(NO_AUTORIZADO);
    expect(dbSelect).not.toHaveBeenCalled();
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it.each([
    ["no numérico", "abc"],
    ["cero", "0"],
    ["negativo", "-1"],
    ["no seguro", String(2 ** 53)],
  ])("rechaza id de sesión %s", async (_nombre, id) => {
    sesion(id, "admin");
    await expect(crearUsuario(input)).rejects.toThrow(NO_AUTORIZADO);
    expect(dbSelect).not.toHaveBeenCalled();
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it("rechaza operador aunque pida rol admin", async () => {
    sesion("2", "operador");
    await expect(crearUsuario({ ...input, role: "admin" })).rejects.toThrow(
      NO_AUTORIZADO
    );
    expect(dbSelect).not.toHaveBeenCalled();
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it("ignora un segundo argumento forjado con sesión anónima", async () => {
    authMock.mockResolvedValue(null);
    const crearConActor = crearUsuario as unknown as (
      datos: typeof input,
      actor: unknown
    ) => Promise<unknown>;
    await expect(
      crearConActor(input, { id: 1, role: "admin" })
    ).rejects.toThrow(NO_AUTORIZADO);
    expect(dbSelect).not.toHaveBeenCalled();
    expect(dbInsert).not.toHaveBeenCalled();
  });
});

describe("listarUsuarios() — guardas", () => {
  it("rechaza sin sesión sin consultar", async () => {
    authMock.mockResolvedValue(null);
    await expect(listarUsuarios()).rejects.toThrow(NO_AUTORIZADO);
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it("rechaza operador sin consultar", async () => {
    sesion("2", "operador");
    await expect(listarUsuarios()).rejects.toThrow(NO_AUTORIZADO);
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it("admin válido pasa la guarda", async () => {
    sesion("1", "admin");
    await expect(listarUsuarios()).resolves.toEqual([]);
    expect(dbSelect).toHaveBeenCalledTimes(1);
  });
});

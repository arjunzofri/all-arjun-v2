/** Fase B — inv-04: registrarConteo() server-action. Riesgos: guardas antes de DB, DTO seguro, replay, conflicto, error sin filtrar. */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";

const { authMock, flagMock, dbExecute } = vi.hoisted(() => ({ authMock: vi.fn(), flagMock: vi.fn(), dbExecute: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: flagMock }));
vi.mock("@/db", () => ({ db: { execute: dbExecute } }));

// Producto ausente a proposito: ROJO valido de Fase B.
import { registrarConteo } from "@/lib/inventario/conteos";

const FILA = { id: 5, producto_id: 1, bodega: 1, planta: "", pasillo: "A1", posicion: "F", cantidad: 0, usuario_id: 12, idempotency_key: "12:x", creado_en: "2026-11-17T10:00:00.000Z" };
const DTO = { id: 5, productoId: 1, bodega: 1, planta: "", pasillo: "A1", posicion: "F", cantidad: 0, usuarioId: 12, creadoEn: "2026-11-17T10:00:00.000Z" };
const respuesta = (r: unknown) => ({ rows: [{ r }] });
const base = () => ({ productoId: 1, ubicacion: { bodega: 1, planta: "", pasillo: "A1", posicion: "F" }, cantidad: 0, expectedConteoId: null, idempotencyKey: randomUUID() });
const valores = (x: unknown): unknown[] => Array.isArray(x) ? x.flatMap(valores) : x && typeof x === "object" ? Object.values(x as Record<string, unknown>).flatMap(valores) : [x];

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "12" } });
  flagMock.mockReturnValue(true);
  dbExecute.mockResolvedValue(respuesta({ ok: true, conteo: FILA, repetido: false }));
});

describe("registrarConteo — guardas antes de DB", () => {
  it("rechaza anonimo y user id invalido sin llamar DB", async () => {
    authMock.mockResolvedValue(null);
    expect((await registrarConteo(base())).ok).toBe(false);
    authMock.mockResolvedValue({ user: { id: "abc" } });
    expect((await registrarConteo(base())).ok).toBe(false);
    authMock.mockResolvedValue({ user: { id: 0 } });
    expect((await registrarConteo(base())).ok).toBe(false);
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it("rechaza flag apagado sin llamar DB", async () => {
    flagMock.mockReturnValue(false);
    expect((await registrarConteo(base())).ok).toBe(false);
    expect(dbExecute).not.toHaveBeenCalled();
  });

  it.each<[string, unknown]>([
    ["cantidad negativa", { ...base(), cantidad: -1 }],
    ["cantidad decimal", { ...base(), cantidad: 1.5 }],
    ["cantidad string", { ...base(), cantidad: "5" }],
    ["cantidad vacia", { ...base(), cantidad: "" }],
    ["sin ubicacion", (({ ubicacion: _u, ...r }) => (void _u, r))(base())],
    ["ubicacion cross-bodega", { ...base(), ubicacion: { bodega: 1, planta: "ARRIBA", pasillo: "A1", posicion: "F" } }],
    ["usuario extra", { ...base(), usuarioId: 99 }],
    ["fecha extra", { ...base(), fecha: "2026-01-01" }],
    ["UUID invalido", { ...base(), idempotencyKey: "no-uuid" }],
    ["expected ausente", (({ expectedConteoId: _e, ...r }) => (void _e, r))(base())],
  ])("rechaza input invalido: %s", async (_n, input) => {
    expect((await registrarConteo(input)).ok).toBe(false);
    expect(dbExecute).not.toHaveBeenCalled();
  });
});

describe("registrarConteo — llamada y respuesta", () => {
  it("guarda cantidad 0 con usuario de sesion y devuelve DTO sin idempotency_key", async () => {
    const key = randomUUID();
    const r = await registrarConteo({ ...base(), idempotencyKey: key });
    expect(dbExecute).toHaveBeenCalledTimes(1);
    const vals = valores(dbExecute.mock.calls[0]);
    expect(vals).toContain(12);
    expect(vals.some((v) => typeof v === "string" && v === `12:${key}`)).toBe(true);
    expect(r).toEqual({ ok: true, conteo: DTO, repetido: false });
    expect(JSON.stringify(r)).not.toContain("idempotency");
    expect(JSON.stringify(r)).not.toContain(`12:${key}`);
  });

  it("replay devuelve el mismo id y fecha con repetido=true", async () => {
    dbExecute.mockResolvedValue(respuesta({ ok: true, conteo: FILA, repetido: true }));
    expect(await registrarConteo(base())).toEqual({ ok: true, conteo: DTO, repetido: true });
  });

  it("conflicto con vigente null responde sin una segunda llamada", async () => {
    dbExecute.mockResolvedValue(respuesta({ ok: false, conflicto: true, vigente: null }));
    expect(await registrarConteo({ ...base(), expectedConteoId: 9 })).toEqual({ ok: false, conflicto: true, vigente: null });
    expect(dbExecute).toHaveBeenCalledTimes(1);
  });

  it("error de DB con URL/credenciales responde mensaje fijo sin filtrar", async () => {
    dbExecute.mockRejectedValue(new Error("fallo https://user:secret@prod.neon.tech/db"));
    const r = await registrarConteo(base());
    expect(r.ok).toBe(false);
    const salida = JSON.stringify(r);
    expect(salida).not.toContain("secret");
    expect(salida).not.toContain("neon.tech");
    expect(salida).not.toContain("https://");
  });
});

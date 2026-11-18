/** Fase B — 17.3-search-api: GET /api/inventario/buscar. Guardas antes de DB, DTO sin nextCursor, error sin leak, cache. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FilaInventario } from "@/lib/inventario/consultas";

const h = vi.hoisted(() => ({ auth: vi.fn(), flag: vi.fn(), listar: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: h.flag }));
vi.mock("@/lib/inventario/consultas", () => ({ listarInventario: h.listar }));

import { GET } from "@/app/api/inventario/buscar/route";

const BASE = process.env.NEXTAUTH_URL;
if (!BASE) throw new Error("NEXTAUTH_URL requerido desde .env.local");
const URL_BASE = `${BASE}/api/inventario/buscar`;
const req = (qs = "?q=abc") => new Request(URL_BASE + qs);

const fila = (id: number): FilaInventario => ({
  id, codigo: `C${id}`, detalle: null, codigoPersonal: null, packing: null,
  observaciones: null, imagenUrl: null, posiciones: [], stockContado: null,
});
const ITEMS = Array.from({ length: 12 }, (_, i) => fila(i + 1));

const ERROR_500 = "No se pudo buscar. Intente nuevamente.";
const ERROR_400 = "Parámetros de búsqueda inválidos.";
const noStore = (res: Response) =>
  expect(res.headers.get("cache-control")).toBe("no-store");
const llamar = async (qs?: string) => {
  const res = await GET(req(qs));
  return { res, body: (await res.json()) as Record<string, unknown> };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.mockResolvedValue({ user: { id: "12", role: "operador" } });
  h.flag.mockReturnValue(true);
  h.listar.mockResolvedValue({ items: ITEMS, nextCursor: null });
});

describe("guardas antes de consultar", () => {
  it("anónimo → 401 sin consultar", async () => {
    h.auth.mockResolvedValue(null);
    const { res, body } = await llamar();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "No autorizado" });
    noStore(res);
    expect(h.listar).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-1", "1.5", ""])("id inválido %j → 401 sin consultar", async (id) => {
    h.auth.mockResolvedValue({ user: { id } });
    const { res, body } = await llamar();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "No autorizado" });
    noStore(res);
    expect(h.listar).not.toHaveBeenCalled();
  });

  it("flag OFF → 404 antes de validar query y sin consultar", async () => {
    h.flag.mockReturnValue(false);
    const { res, body } = await llamar("");
    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "No encontrado" });
    noStore(res);
    expect(h.listar).not.toHaveBeenCalled();
  });

  it("excepción de auth → 500 fijo sin filtrar URL ni consultar", async () => {
    h.auth.mockRejectedValue(new Error("fallo https://user:secret@prod.neon.tech/db"));
    const { res, body } = await llamar();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: ERROR_500 });
    const texto = JSON.stringify(body);
    ["secret", "neon.tech", "https://", "prod"].forEach((s) => expect(texto).not.toContain(s));
    noStore(res);
    expect(h.listar).not.toHaveBeenCalled();
  });

  it("cualquier rol con sesión válida consulta y recibe 200", async () => {
    h.auth.mockResolvedValue({ user: { id: "7", role: "admin" } });
    expect((await llamar()).res.status).toBe(200);
  });
});

describe("validación estricta de query sin consultar", () => {
  it.each([
    ["sin q", ""],
    ["q repetido", "?q=a&q=b"],
    ["extra limit", "?q=a&limit=5"],
    ["q vacío", "?q="],
    ["q solo espacios", "?q=%20%20"],
    ["q mayor a 100", `?q=${"x".repeat(101)}`],
  ])("%s → 400", async (_n, qs) => {
    const { res, body } = await llamar(qs);
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: ERROR_400 });
    noStore(res);
    expect(h.listar).not.toHaveBeenCalled();
  });
});

describe("consulta y DTO", () => {
  it("trim, limit fijo 12, solo items y sin nextCursor", async () => {
    const { res, body } = await llamar("?q=%20%20abc%20%20");
    expect(res.status).toBe(200);
    expect(h.listar).toHaveBeenCalledWith({ q: "abc", limit: 12 });
    expect(body).toEqual({ items: ITEMS });
    expect(Object.keys(body)).toEqual(["items"]);
    expect(body).not.toHaveProperty("nextCursor");
    expect(body.items).toHaveLength(12);
    noStore(res);
  });

  it("comodines % _ \\ se delegan literales sin re-escapar", async () => {
    const q = "%_\\";
    const { res } = await llamar(`?q=${encodeURIComponent(q)}`);
    expect(res.status).toBe(200);
    expect(h.listar).toHaveBeenCalledWith({ q, limit: 12 });
  });
});

describe("errores de consulta", () => {
  it.each([
    ["timeout", new Error("timeout https://user:secret@prod.neon.tech/db")],
    ["inesperado", new Error("boom")],
  ])("%s → 500 fijo sin filtrar detalles", async (_n, error) => {
    h.listar.mockRejectedValue(error);
    const { res, body } = await llamar();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: ERROR_500 });
    const texto = JSON.stringify(body);
    ["secret", "neon.tech", "https://", "timeout", "boom"].forEach((s) =>
      expect(texto).not.toContain(s),
    );
    noStore(res);
  });
});

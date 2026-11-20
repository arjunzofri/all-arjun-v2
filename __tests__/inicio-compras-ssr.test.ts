/**
 * inv-22d-3 — SSR del inicio ON: seccion Compras, estado y boton; OFF intacto.
 * Neon, auth, flags y vistas mockeados: no toca DB ni VD.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({
  sql: vi.fn(),
  auth: vi.fn(),
  flags: { inventario_bodega: true, identificacion_foto: true } as Record<string, boolean>,
  getBodegas: vi.fn(),
  getModulos: vi.fn(),
}));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn(() => m.sql) }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: (k: string) => m.flags[k] === true }));
vi.mock("@/lib/actions/vistas", () => ({ getBodegas: m.getBodegas, getModulos: m.getModulos }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), redirect: vi.fn() }));
vi.mock("@/components/inventario/BuscadorInventario", () => ({ default: () => "BUSCADOR" }));

import DashboardPage from "@/app/(dashboard)/page";

let corridas: unknown[] = [];
let watermarks: unknown[] = [];

beforeEach(() => {
  corridas = []; watermarks = [];
  m.sql.mockReset();
  m.sql.mockImplementation(async (s: TemplateStringsArray) => {
    const texto = s.join("?");
    if (texto.includes("FROM activity_log")) return corridas;
    if (texto.includes("FROM sync_watermark")) return watermarks;
    return [];
  });
  m.auth.mockResolvedValue({ user: { id: "62", username: "qa" } });
  m.flags.inventario_bodega = true;
  m.getBodegas.mockResolvedValue([]); m.getModulos.mockResolvedValue([]);
});

describe("inicio SSR", () => {
  const render = async () => renderToStaticMarkup((await DashboardPage()) as ReactElement);

  it("ON muestra seccion, estado y boton", async () => {
    corridas = [{
      detalles: { ok: true, insertadas: 4 },
      created_at: "2026-11-20T13:05:00.000Z",
    }];
    watermarks = [{ value: "2026-11-10" }];
    const html = await render();
    ["Compras", "ACTUALIZAR", "Última actualización: 20-11-2026", "Compras al: 10-11-2026"]
      .forEach((s) => expect(html).toContain(s));
    expect(html).not.toContain("Aún no se han importado compras");
  });

  it("ON sin corridas muestra el aviso inicial", async () => {
    expect(await render()).toContain("Aún no se han importado compras");
  });

  it("D2: si falla la lectura del estado no miente y el boton sigue", async () => {
    m.sql.mockRejectedValue(new Error("db caida"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = await render();
    expect(html).toContain("No se pudo leer el estado de compras");
    expect(html).toContain("ACTUALIZAR");
    expect(html).not.toContain("Aún no se han importado compras");
    errorLog.mockRestore();
  });

  it("D2: sin corrida pero con watermark muestra Compras al", async () => {
    watermarks = [{ value: "2026-11-10" }];
    const html = await render();
    expect(html).toContain("Compras al: 10-11-2026");
    expect(html).not.toContain("Aún no se han importado compras");
  });

  it("OFF no muestra la seccion nueva", async () => {
    m.flags.inventario_bodega = false;
    const html = await render();
    expect(html).not.toContain("ACTUALIZAR");
    expect(html).not.toContain("Aún no se han importado compras");
  });
});

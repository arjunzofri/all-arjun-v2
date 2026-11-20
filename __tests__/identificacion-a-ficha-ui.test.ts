// inv-20.3c — Navegacion ON/OFF del identificador. Sin DB ni servicios externos.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/actions/identificacion", () => ({
  abrirProductoIdentificado: vi.fn(),
  generarCodigoAlternativo: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((u: string) => { throw new Error(`REDIRECT:${u}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  useRouter: () => ({ push: vi.fn() }),
}));

import IdentificarProducto from "@/components/identificacion/IdentificarProducto";
import IdentificarPage from "@/app/(dashboard)/entradas/identificar/page";

const render = (modoInventario: boolean) =>
  renderToStaticMarkup(createElement(IdentificarProducto, { modoInventario }));

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: 1, email: "qa@arjun.local", role: "operador" } });
  process.env.FEATURE_IDENTIFICACION_FOTO = "true";
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
});

describe("UI y page — navegacion ON/OFF", () => {
  it("SSR: Buscar manualmente va a /inventario/nuevo en ON y a /entradas en OFF", () => {
    expect(render(true)).toContain('href="/inventario/nuevo"');
    expect(render(false)).toContain('href="/entradas"');
  });

  it("source ON: Abrir ficha -> /productos/ y crear codigo -> /inventario/nuevo", () => {
    const src = readFileSync(join(process.cwd(), "components/identificacion/IdentificarProducto.tsx"), "utf8");
    expect(src).toContain("abrirProductoIdentificado");
    expect(src).toContain("Abrir ficha");
    expect(src).toContain("`/productos/${r.id}`");
    expect(src).toContain("/inventario/nuevo?codigo=");
    expect(src).toContain("Usar este código");
    expect(src).toContain("/entradas?codigo=${encodeURIComponent(elegido)}");
  });

  it("page pasa modoInventario segun el flag", async () => {
    let el = (await IdentificarPage()) as ReactElement;
    expect((el.props as { modoInventario: boolean }).modoInventario).toBe(true);
    process.env.FEATURE_INVENTARIO_BODEGA = "false";
    el = (await IdentificarPage()) as ReactElement;
    expect((el.props as { modoInventario: boolean }).modoInventario).toBe(false);
  });
});

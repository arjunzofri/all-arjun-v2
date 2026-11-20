// inv-20.2 — UI de creacion manual/historica. Sin servicios externos: buscador mockeado.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({ flags: { inventario_bodega: true } as Record<string, boolean>, auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: (k: string) => m.flags[k] === true }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((u: string) => { throw new Error(`REDIRECT:${u}`); }), usePathname: () => "/inventario", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/components/inventario/BuscadorInventario", () => ({ default: () => "BUSCADOR" }));
vi.mock("@/components/useProductoSearch", () => ({ createProductoSearch: () => ({ search: vi.fn(), dispose: vi.fn() }) }));
vi.mock("@/lib/actions/productos", () => ({ crearProductoManual: vi.fn() }));
import NuevoProducto, { crearEnvio, MENSAJE_FIJO, prepararCreacion } from "@/components/inventario/NuevoProducto";
import NuevoPage from "@/app/(dashboard)/inventario/nuevo/page";
import InventarioShell from "@/components/inventario/InventarioShell";
import DashboardShell from "@/components/DashboardShell";
beforeEach(() => { vi.clearAllMocks(); m.flags.inventario_bodega = true; m.auth.mockResolvedValue({ user: { id: "7", username: "pablo", role: "operador" } }); });
const pagina = async (codigo?: string) => renderToStaticMarkup((await NuevoPage({ searchParams: Promise.resolve({ codigo }) })) as ReactElement);
const form = (codigoInicial: string) => renderToStaticMarkup(createElement(NuevoProducto, { codigoInicial }));
describe("prepararCreacion", () => {
  it("trim; detalle y packing vacios se omiten; 0 es valido", () => {
    expect(prepararCreacion({ codigo: " AB ", detalle: " X ", packing: "" })).toEqual({ ok: true, data: { codigo: "AB", detalle: "X" } });
    expect(prepararCreacion({ codigo: "AB", detalle: " ", packing: "0" })).toEqual({ ok: true, data: { codigo: "AB", packing: 0 } });
  });
  it("rechaza codigo vacio, >30 y packing -1/1.5/abc", () => {
    expect(prepararCreacion({ codigo: "  ", detalle: "", packing: "" }).ok).toBe(false);
    expect(prepararCreacion({ codigo: "X".repeat(31), detalle: "", packing: "" }).ok).toBe(false);
    for (const packing of ["-1", "1.5", "abc"]) expect(prepararCreacion({ codigo: "A", detalle: "", packing }).ok).toBe(false);
  });
});
describe("crearEnvio", () => {
  it("accion que rechaza: mensaje fijo y cerrojo liberado en el segundo intento", async () => {
    const accion = vi.fn().mockRejectedValue(new Error("red"));
    const envio = crearEnvio(accion);
    expect(await envio.ejecutar({ codigo: "A", detalle: "", packing: "" })).toEqual({ ok: false, error: MENSAJE_FIJO });
    expect(await envio.ejecutar({ codigo: "A", detalle: "", packing: "" })).toEqual({ ok: false, error: MENSAJE_FIJO });
    expect(accion).toHaveBeenCalledTimes(2);
  });
  it("valida antes de llamar y propaga el error de la accion", async () => {
    const accion = vi.fn().mockResolvedValue({ ok: false, error: "No autorizado" });
    expect((await crearEnvio(accion).ejecutar({ codigo: "", detalle: "", packing: "" }))?.ok).toBe(false);
    expect(accion).not.toHaveBeenCalled();
    expect(await crearEnvio(accion).ejecutar({ codigo: "A", detalle: "", packing: "" })).toEqual({ ok: false, error: "No autorizado" });
  });
});
describe("pagina /inventario/nuevo", () => {
  it("sin sesion -> /login y flag OFF -> /productos", async () => {
    m.auth.mockResolvedValue(null);
    await expect(pagina()).rejects.toThrow("REDIRECT:/login");
    m.auth.mockResolvedValue({ user: { id: "7" } });
    m.flags.inventario_bodega = false;
    await expect(pagina()).rejects.toThrow("REDIRECT:/productos");
  });
  it("ON: form con codigoInicial recortado a 30", async () => {
    const html = await pagina(`  ${"X".repeat(40)}  `);
    expect(html).toContain(`value="${"X".repeat(30)}"`);
    expect(html).toContain("Detalle");
    expect(html).toContain("Packing");
  });
});
describe("acceso en shells", () => {
  it("InventarioShell (ON) muestra el link; DashboardShell legacy no", () => {
    const on = renderToStaticMarkup(createElement(InventarioShell, { userId: "7", username: "pablo", esAdmin: false }, "CONT"));
    expect(on).toContain('href="/inventario/nuevo"');
    expect(on).toContain("Crear producto");
    // eslint-disable-next-line react/no-children-prop
    const off = renderToStaticMarkup(createElement(DashboardShell, { showIdentificacion: false, showInversion: false, showUsuarios: false, children: "CONT" }));
    expect(off).not.toContain('href="/inventario/nuevo"');
  });
  it("SSR del formulario: 'Crear producto' y no 'Registrar entrada'", () => {
    const html = form("ARJ-1");
    expect(html).toContain("Crear producto");
    expect(html).toContain('value="ARJ-1"');
    expect(html).not.toContain("Registrar entrada");
  });
});

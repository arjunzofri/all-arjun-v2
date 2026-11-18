import { beforeEach, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({ flags: { inventario_bodega: false, identificacion_foto: true } as Record<string, boolean>, path: "/inventario", auth: vi.fn(), getBodegas: vi.fn(), getModulos: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: (k: string) => m.flags[k] === true }));
vi.mock("@/lib/actions/vistas", () => ({ getBodegas: m.getBodegas, getModulos: m.getModulos }));
vi.mock("next/navigation", () => ({ usePathname: () => m.path, useRouter: () => ({ push: vi.fn() }), redirect: vi.fn((u: string) => { throw new Error(`REDIRECT:${u}`); }) }));
vi.mock("@/components/DashboardShell", () => ({ default: () => "SHELL-LEGACY" }));
vi.mock("@/components/inventario/BuscadorInventario", () => ({ default: (p: { grande?: boolean }) => (p.grande ? "BUSCADOR-GRANDE" : "BUSCADOR") }));
import { createLogoutHandler } from "@/components/LogoutButton";
import InventarioShell from "@/components/inventario/InventarioShell";
import InicioInventario from "@/components/inventario/InicioInventario";
import DashboardLayout from "@/app/(dashboard)/layout";
import DashboardPage from "@/app/(dashboard)/page";

const shell = (esAdmin = false) => renderToStaticMarkup(createElement(InventarioShell, { userId: "7", username: "pablo", esAdmin }, "CONT"));
const layout = async () => renderToStaticMarkup((await DashboardLayout({ children: "CONT" })) as ReactElement);
const home = async () => renderToStaticMarkup((await DashboardPage()) as ReactElement);

beforeEach(() => {
  vi.clearAllMocks();
  m.flags.inventario_bodega = false; m.flags.identificacion_foto = true; m.path = "/inventario";
  m.auth.mockResolvedValue({ user: { id: "7", username: "pablo", role: "admin" } });
  m.getBodegas.mockResolvedValue([{ id: 1, nombre: "B1", totalStock: 2 }]); m.getModulos.mockResolvedValue([{ id: 1, nombre: "M1", totalStock: 3 }]);
});

it("shell interna: Arjun, Inventario real, un buscador, bodega SSR y sin menús legacy", () => {
  const html = shell();
  ["Arjun", 'href="/inventario"', "pablo", "BUSCADOR", "Estoy contando en", "CONT", "Cerrar sesión", "Elegir bodega", "Bodega 1", "Bodega 2"].forEach((s) => expect(html).toContain(s));
  expect(html).toMatch(/<option[^>]*selected[^>]*>Elegir bodega<\/option>/); expect((html.match(/BUSCADOR/g) ?? []).length).toBe(1);
  ["Inversión", "Bodegas", "Módulos", "Movimientos", "Transferencias", "Planta", "Pasillo"].forEach((s) => expect(html).not.toContain(s));
});

it("shell en / no duplica buscador; Usuarios solo admin", () => {
  m.path = "/"; expect(shell()).not.toContain("BUSCADOR"); m.path = "/inventario";
  expect(shell(true)).toContain("Usuarios"); expect(shell(false)).not.toContain("Usuarios");
});

it("logout: callback una vez, antes de signOut, con redirectTo", async () => {
  const orden: string[] = [];
  await createLogoutHandler(vi.fn(async () => { orden.push("signOut"); }), () => false, () => {}, () => orden.push("callback"));
  expect(orden).toEqual(["callback", "signOut"]);
});

it("logout: callback que lanza no impide signOut ni deja pending", async () => {
  let pending = false; const signOut = vi.fn(async () => {});
  await expect(createLogoutHandler(signOut, () => pending, (v) => { pending = v; }, () => { throw new Error("x"); })).resolves.toBeUndefined();
  expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" }); expect(pending).toBe(false);
});

it("logout: 3 argumentos compatibles y pending en vuelo", async () => {
  let resolve!: () => void; let pending = false; const signOut = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
  const p = createLogoutHandler(signOut, () => pending, (v) => { pending = v; });
  expect(pending).toBe(true); resolve(); await p; expect(pending).toBe(false);
  signOut.mockResolvedValue(undefined); await createLogoutHandler(signOut, () => false, () => {});
  expect(signOut).toHaveBeenLastCalledWith({ redirectTo: "/login" });
});

it("layout ON usa shell nueva; OFF conserva DashboardShell legacy", async () => {
  m.flags.inventario_bodega = true; const on = await layout();
  expect(on).toContain("Estoy contando en"); expect(on).toContain("CONT"); expect(on).not.toContain("SHELL-LEGACY");
  m.flags.inventario_bodega = false; const off = await layout();
  expect(off).toContain("SHELL-LEGACY"); expect(off).not.toContain("Estoy contando en");
});

it("home ON: hero antes de queries e identificación según flag; OFF conserva dashboard con queries", async () => {
  m.flags.inventario_bodega = true; const on = await home();
  ["¿Qué producto vas a contar?", "BUSCADOR-GRANDE", "Ver todo el inventario", 'href="/inventario"', 'href="/entradas/identificar"'].forEach((s) => expect(on).toContain(s));
  expect(m.getBodegas).not.toHaveBeenCalled(); expect(m.getModulos).not.toHaveBeenCalled();
  m.flags.identificacion_foto = false; expect(await home()).not.toContain("/entradas/identificar");
  m.flags.inventario_bodega = false; const off = await home();
  expect(off).toContain("Dashboard"); expect(m.getBodegas).toHaveBeenCalled(); expect(m.getModulos).toHaveBeenCalled();
});

it("InicioInventario: links reales, sin placeholders ni botones deshabilitados", () => {
  const si = renderToStaticMarkup(createElement(InicioInventario, { username: "pablo", mostrarIdentificacion: true }));
  const no = renderToStaticMarkup(createElement(InicioInventario, { username: "pablo", mostrarIdentificacion: false }));
  expect(si).toContain("Identificar por foto"); expect(si).toContain('href="/entradas/identificar"'); expect(no).not.toContain("Identificar por foto");
  [si, no].forEach((html) => {
    expect(html).toContain("¿Qué producto vas a contar?"); expect(html).toContain("Ver todo el inventario"); expect(html).toContain('href="/inventario"');
    expect(html).not.toContain('href="#"'); expect(html).not.toMatch(/aria-disabled|Próximamente|Proximamente/);
  });
});

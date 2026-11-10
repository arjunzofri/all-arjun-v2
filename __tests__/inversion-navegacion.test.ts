/**
 * Fase B — Módulo 2, Slice 5c: navegación a /inversion-mercaderia.
 *
 * El item del sidebar solo aparece con showInversion=true, y el layout
 * server lo habilita únicamente para admin con el flag activo.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: vi.fn() }));

import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import DashboardShell from "@/components/DashboardShell";
import DashboardLayout from "@/app/(dashboard)/layout";

const mockAuth = vi.mocked(auth);
const mockFlag = vi.mocked(flagActivo);

const children = React.createElement("div", null, "contenido");

function renderShell(showInversion: boolean) {
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop
    React.createElement(DashboardShell, { showInversion, showIdentificacion: false, children })
  );
}

describe("DashboardShell — item Inversion", () => {
  it("con showInversion=true muestra el link", () => {
    expect(renderShell(true)).toContain('href="/inversion-mercaderia"');
    expect(renderShell(true)).toContain("Inversión");
  });

  it("con showInversion=false no muestra el link", () => {
    expect(renderShell(false)).not.toContain("/inversion-mercaderia");
    expect(renderShell(false)).not.toContain(">Inversión<");
  });

  it("el resto del NAV no cambia y los children se renderizan", () => {
    const html = renderShell(false);
    expect(html).toContain('href="/productos"');
    expect(html).toContain('href="/movimientos"');
    expect(html).toContain("contenido");
  });
});

describe("layout server — showInversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function showInversionDe(
    sesion: { user?: { role?: string } } | null,
    flag: boolean
  ): Promise<boolean> {
    mockAuth.mockResolvedValue(sesion as never);
    mockFlag.mockReturnValue(flag);
    const el = (await DashboardLayout({ children })) as React.ReactElement;
    return (el.props as { showInversion: boolean }).showInversion;
  }

  it("admin + flag activo → true", async () => {
    expect(
      await showInversionDe({ user: { role: "admin" } }, true)
    ).toBe(true);
  });

  it("operador + flag activo → false", async () => {
    expect(
      await showInversionDe({ user: { role: "operador" } }, true)
    ).toBe(false);
  });

  it("admin + flag apagado → false", async () => {
    expect(
      await showInversionDe({ user: { role: "admin" } }, false)
    ).toBe(false);
  });

  it("sin sesión → false", async () => {
    expect(await showInversionDe(null, true)).toBe(false);
  });

  it("consulta el flag inversion_mercaderia", async () => {
    await showInversionDe({ user: { role: "admin" } }, true);
    expect(mockFlag).toHaveBeenCalledWith("inversion_mercaderia");
  });
});

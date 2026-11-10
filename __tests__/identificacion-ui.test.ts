/**
 * Fase B — Módulo 1, Slice 8: pantalla de identificación por foto.
 * Cubre utilidades puras, page server (acceso), navegación y límites client/server.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: vi.fn() }));

import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import { redirect, notFound } from "next/navigation";
import { dimensionesEscaladas, miniaturaCloudinary } from "@/lib/utils/comprimir-imagen";
import DashboardShell from "@/components/DashboardShell";
import DashboardLayout from "@/app/(dashboard)/layout";
import IdentificarPage, { dynamic } from "@/app/(dashboard)/entradas/identificar/page";
import { codigoDesdeQuery } from "@/app/(dashboard)/entradas/page";

const mockAuth = vi.mocked(auth);
const mockFlag = vi.mocked(flagActivo);
const children = React.createElement("div", null, "contenido");

beforeEach(() => vi.clearAllMocks());

describe("dimensionesEscaladas", () => {
  it("no agranda imágenes menores al máximo", () => {
    expect(dimensionesEscaladas(1000, 800, 1280)).toEqual({ ancho: 1000, alto: 800 });
  });
  it("escala por el lado mayor horizontal", () => {
    expect(dimensionesEscaladas(2000, 1000, 1280)).toEqual({ ancho: 1280, alto: 640 });
  });
  it("escala por el lado mayor vertical", () => {
    expect(dimensionesEscaladas(800, 2000, 1280)).toEqual({ ancho: 512, alto: 1280 });
  });
  it("redondea y tolera dimensiones inválidas", () => {
    expect(dimensionesEscaladas(1000, 333, 500)).toEqual({ ancho: 500, alto: 167 });
    expect(dimensionesEscaladas(0, 100, 1280)).toEqual({ ancho: 0, alto: 0 });
  });
});

describe("miniaturaCloudinary", () => {
  it("inserta la transformación de miniatura", () => {
    expect(miniaturaCloudinary("https://res.cloudinary.com/x/image/upload/v1/a.jpg", 160))
      .toBe("https://res.cloudinary.com/x/image/upload/w_160,h_160,c_pad,b_white,f_jpg,q_70/v1/a.jpg");
  });
  it("deja intactas las URLs ajenas a Cloudinary", () => {
    expect(miniaturaCloudinary("https://otro.com/a.jpg", 160)).toBe("https://otro.com/a.jpg");
  });
});

describe("página /entradas/identificar", () => {
  it("es force-dynamic", () => expect(dynamic).toBe("force-dynamic"));

  it("sin sesión → redirect /login", async () => {
    mockAuth.mockResolvedValue(null as never);
    mockFlag.mockReturnValue(true);
    await expect(IdentificarPage()).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("flag apagado → notFound", async () => {
    mockAuth.mockResolvedValue({ user: { role: "operador" } } as never);
    mockFlag.mockReturnValue(false);
    await expect(IdentificarPage()).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("cualquier rol con flag activo → renderiza", async () => {
    mockAuth.mockResolvedValue({ user: { role: "operador" } } as never);
    mockFlag.mockReturnValue(true);
    expect(React.isValidElement(await IdentificarPage())).toBe(true);
  });
});

describe("DashboardShell — item Identificar por foto", () => {
  const render = (showIdentificacion: boolean) =>
    renderToStaticMarkup(
      // eslint-disable-next-line react/no-children-prop
      React.createElement(DashboardShell, { showInversion: false, showIdentificacion, children })
    );

  it("con la prop activa muestra el link", () => {
    const html = render(true);
    expect(html).toContain('href="/entradas/identificar"');
    expect(html).toContain("Identificar por foto");
  });
  it("con la prop apagada lo oculta", () => {
    const html = render(false);
    expect(html).not.toContain("/entradas/identificar");
  });
});

describe("layout server — showIdentificacion", () => {
  it("flag activo → true para operador", async () => {
    mockAuth.mockResolvedValue({ user: { role: "operador" } } as never);
    mockFlag.mockReturnValue(true);
    const el = (await DashboardLayout({ children })) as React.ReactElement;
    expect((el.props as { showIdentificacion: boolean }).showIdentificacion).toBe(true);
    expect(mockFlag).toHaveBeenCalledWith("identificacion_foto");
  });
  it("flag apagado → false", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } } as never);
    mockFlag.mockReturnValue(false);
    const el = (await DashboardLayout({ children })) as React.ReactElement;
    expect((el.props as { showIdentificacion: boolean }).showIdentificacion).toBe(false);
  });
});

describe("entradas/page — query ?codigo=", () => {
  it("extrae y recorta el código", () => {
    expect(codigoDesdeQuery("?codigo=ABC123")).toBe("ABC123");
    expect(codigoDesdeQuery("?codigo=%20abi-42%20")).toBe("abi-42");
    expect(codigoDesdeQuery("?otro=1")).toBe("");
    expect(codigoDesdeQuery("")).toBe("");
  });
});

describe("IdentificarProducto — opción de preselección", () => {
  const src = readFileSync(join(process.cwd(), "components/identificacion/IdentificarProducto.tsx"), "utf8");
  it("rotula la opción no visual como 'Otra posibilidad'", () => {
    expect(src).toContain('op.fuente === "preseleccion"');
    expect(src).toContain("Otra posibilidad");
  });
  it("no recorta las opciones en el cliente", () => {
    expect(src).not.toMatch(/opciones\.slice\(/);
  });
});

describe("límite client/server", () => {
  it("ningún archivo 'use client' importa lib/identificacion", () => {
    const archivos: string[] = [];
    for (const dir of ["app", "components"]) {
      for (const rel of readdirSync(join(process.cwd(), dir), { recursive: true }) as string[]) {
        if (/\.(tsx|ts)$/.test(rel)) archivos.push(join(dir, rel));
      }
    }
    const infractores = archivos.filter((rel) => {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      return src.startsWith('"use client"') && /@\/lib\/identificacion/.test(src);
    });
    expect(infractores).toEqual([]);
  });
});

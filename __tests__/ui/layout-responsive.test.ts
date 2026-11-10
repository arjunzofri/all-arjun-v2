import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf-8");

describe("DashboardShell — sidebar responsive", () => {
  const src = read("components/DashboardShell.tsx");

  it("es un client component (drawer mobile requiere estado)", () => {
    expect(src).toContain('"use client"');
  });

  it("tiene estado para abrir/cerrar sidebar en mobile", () => {
    expect(src).toContain("useState");
  });

  it("sidebar es hidden en mobile y visible en lg", () => {
    expect(src).toMatch(/hidden.*lg:flex|lg:block.*hidden/);
  });

  it("tiene botón hamburger para mobile", () => {
    expect(src).toContain("lg:hidden");
  });

  it("tiene overlay para cerrar el drawer", () => {
    expect(src.includes("overlay") || src.includes("inset-0")).toBe(true);
  });
});

describe("app/(dashboard)/layout.tsx — server component", () => {
  const src = read("app/(dashboard)/layout.tsx");

  it("no es client component", () => {
    expect(src).not.toContain('"use client"');
  });

  it("importa y renderiza DashboardShell", () => {
    expect(src).toMatch(/import\s+DashboardShell\s+from\s+["']@\/components\/DashboardShell["']/);
    expect(src).toContain("<DashboardShell");
  });

  it("calcula showInversion con rol admin y flag inversion_mercaderia", () => {
    expect(src).toMatch(/role\s*===\s*["']admin["']/);
    expect(src).toMatch(/flagActivo\(\s*["']inversion_mercaderia["']\s*\)/);
  });

  it("no conserva NAV ni estado propio", () => {
    expect(src).not.toContain("useState");
    expect(src).not.toContain("usePathname");
    expect(src).not.toContain("const NAV");
  });
});

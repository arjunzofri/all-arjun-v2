import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("dashboard layout — sidebar responsive", () => {
  const src = readFileSync(
    join(process.cwd(), "app", "(dashboard)", "layout.tsx"),
    "utf-8"
  );

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


import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("layout.tsx viewport y metadata PWA", () => {
  const src = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf-8");

  it("exporta viewport con themeColor violet", () => {
    expect(src).toContain("export const viewport");
    expect(src).toContain("#7c3aed");
  });

  it("metadata incluye manifest", () => {
    expect(src).toContain('manifest: "/manifest.json"');
  });

  it("metadata incluye appleWebApp", () => {
    expect(src).toContain("appleWebApp");
    expect(src).toContain("capable: true");
  });

  it("metadata incluye apple touch icon", () => {
    expect(src).toContain("apple");
    expect(src).toContain("/icon-192.png");
  });
});

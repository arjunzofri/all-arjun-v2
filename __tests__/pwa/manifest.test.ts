import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "public");

describe("PWA manifest", () => {
  it("public/manifest.json existe", () => {
    expect(existsSync(join(ROOT, "manifest.json"))).toBe(true);
  });

  it("manifest tiene campos requeridos", () => {
    const raw = readFileSync(join(ROOT, "manifest.json"), "utf-8");
    const m = JSON.parse(raw);
    expect(m.name).toBe("App Arjun v2");
    expect(m.short_name).toBe("Arjun");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#7c3aed");
    expect(m.start_url).toBe("/");
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
  });

  it("iconos PNG existen en public/", () => {
    expect(existsSync(join(ROOT, "icon-192.png"))).toBe(true);
    expect(existsSync(join(ROOT, "icon-512.png"))).toBe(true);
  });

  it("cada icono tiene src y sizes", () => {
    const m = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf-8"));
    for (const icon of m.icons) {
      expect(icon.src).toBeTruthy();
      expect(icon.sizes).toBeTruthy();
      expect(icon.type).toBe("image/png");
    }
  });
});

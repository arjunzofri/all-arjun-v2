import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("globals.css — design tokens", () => {
  const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf-8");

  it("define --color-accent (violet)", () => {
    expect(css).toContain("--color-accent");
  });

  it("define --color-sidebar-bg (dark)", () => {
    expect(css).toContain("--color-sidebar-bg");
  });

  it("define --color-sidebar-text", () => {
    expect(css).toContain("--color-sidebar-text");
  });
});

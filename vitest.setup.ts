import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ponytail: carga .env.local en vitest sin dependencia extra.
// Next.js lo carga nativo, pero vitest no.
const envPath = resolve(__dirname, ".env.local");
try {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    // Quitar comillas si las tiene
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // .env.local no existe — los tests que requieren DB fallarán con error claro.
}

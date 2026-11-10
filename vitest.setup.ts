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

// Los tests NUNCA usan la base de producción: se apunta a la rama Neon "test".
const testUrl = process.env.TEST_DATABASE_URL;
const prodUrl = process.env.DATABASE_URL;
if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL requerido: los tests nunca usan la base de produccion",
  );
}
const host = (url: string) => new URL(url).host;
if (host(testUrl) === host(prodUrl!)) {
  throw new Error(
    "TEST_DATABASE_URL apunta al mismo host que DATABASE_URL (produccion): los tests nunca usan la base de produccion",
  );
}
process.env.PROD_DATABASE_URL_HOST = host(prodUrl!);
// Reemplazo incondicional: aunque DATABASE_URL ya estuviera definida.
process.env.DATABASE_URL = testUrl;

/**
 * Guardia: ningún test que ejercite el sync real puede tocar la base real.
 *
 * DATABASE_URL apunta a producción. Cualquier test que importe
 * syncComprasAnil, backfillVisaciones o el POST de /api/sync/compras-anil
 * debe mockear @neondatabase/serverless (vi.mock) para no escribir filas.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TESTS_DIR = join(process.cwd(), "__tests__");

// Import statements que significan "ejercita el sync real".
const EJERCITA_SYNC = [
  /\bimport\s*\{[^}]*\bsyncComprasAnil\b[^}]*\}/,
  /\bimport\s*\{[^}]*\bbackfillVisaciones\b[^}]*\}/,
  /\bimport\s*\{[^}]*\bconciliarComprasAnil\b[^}]*\}/,
  /\bimport\s*\{[^}]*\bregistrarConciliacion\b[^}]*\}/,
  /\bimport\s*\{[^}]*\bgetLineasApp\b[^}]*\}/,
  /from\s+["']@\/app\/api\/sync\/compras-anil\/route["']/,
  /from\s+["']@\/app\/api\/sync\/conciliacion\/route["']/,
];

const MOCK_NEON = /vi\.mock\(\s*["']@neondatabase\/serverless["']/;

describe("guardia: tests del sync no escriben en producción", () => {
  it("todo test que importa syncComprasAnil/backfillVisaciones/POST mockea neon", () => {
    const archivos = readdirSync(TESTS_DIR).filter((f) => f.endsWith(".test.ts"));

    const infractores = archivos.filter((f) => {
      const src = readFileSync(join(TESTS_DIR, f), "utf8");
      const ejercitaSync = EJERCITA_SYNC.some((re) => re.test(src));
      return ejercitaSync && !MOCK_NEON.test(src);
    });

    expect(infractores).toEqual([]);
  });
});

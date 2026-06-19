/**
 * Fase B — Sync imagen_url desde Vida Digital: Tests de integración real.
 *
 * Riesgos:
 * 1. Imagen subida por usuario NO se pisa con la de Vida Digital.
 * 2. Producto sin imagen (NULL) SÍ recibe la de Vida Digital.
 * 3. Ambas NULL: el producto queda sin imagen, sin error.
 *
 * Usa la función real upsertProductoDesdeSync() exportada desde compras-anil.ts,
 * NO una copia inline del SQL. El mismo código que corre en producción.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { upsertProductoDesdeSync } from "@/lib/sync/compras-anil";

const sql = neon(process.env.DATABASE_URL!);

const TEST_CODIGO = `SYNC-IMG-${Date.now()}`;

beforeAll(async () => {
  await sql`DELETE FROM movimientos WHERE producto_id = (SELECT id FROM productos WHERE codigo = ${TEST_CODIGO})`;
  await sql`DELETE FROM productos WHERE codigo = ${TEST_CODIGO}`;
});

afterAll(async () => {
  await sql`DELETE FROM movimientos WHERE producto_id = (SELECT id FROM productos WHERE codigo = ${TEST_CODIGO})`;
  await sql`DELETE FROM productos WHERE codigo = ${TEST_CODIGO}`;
});

async function getImagenUrl(codigo: string): Promise<string | null> {
  const r = await sql`SELECT imagen_url FROM productos WHERE codigo = ${codigo}`;
  const rows = r as unknown as { imagen_url: string | null }[];
  return rows[0]?.imagen_url ?? null;
}

describe("sync — producto_ok con COALESCE (integración real)", () => {
  // ── R1: Usuario gana — imagen existente no se pisa ─────────────
  it("no pisa imagen_url si ya fue poblada por el usuario", async () => {
    await sql`DELETE FROM productos WHERE codigo = ${TEST_CODIGO}`;

    // Insert inicial (simula usuario que subió imagen)
    await sql`
      INSERT INTO productos (codigo, detalle, imagen_url)
      VALUES (${TEST_CODIGO}, 'Test producto', 'https://cloudinary.com/user-upload.jpg')
      ON CONFLICT (codigo) DO NOTHING
    `;

    // Segunda sync: Vida Digital trae imagen distinta
    await upsertProductoDesdeSync(sql, { codigo: TEST_CODIGO, detalle: "Test producto", cantcaja: null, imagenUrl: "https://vidadigital.com/catalog.jpg" });

    const url = await getImagenUrl(TEST_CODIGO);
    expect(url).toBe("https://cloudinary.com/user-upload.jpg");
  });

  // ── R2: NULL → se llena con la de Vida Digital ────────────────
  it("llena imagen_url si estaba NULL (primera vez)", async () => {
    // Limpiar estado del test anterior
    await sql`DELETE FROM productos WHERE codigo = ${TEST_CODIGO}`;

    // Insert sin imagen (simula sync inicial antes del fix)
    await sql`
      INSERT INTO productos (codigo, detalle)
      VALUES (${TEST_CODIGO}, 'Test producto')
      ON CONFLICT (codigo) DO NOTHING
    `;

    // Sync con imagen desde VD
    await upsertProductoDesdeSync(sql, { codigo: TEST_CODIGO, detalle: "Test producto", cantcaja: null, imagenUrl: "https://vidadigital.com/catalog.jpg" });

    const url = await getImagenUrl(TEST_CODIGO);
    expect(url).toBe("https://vidadigital.com/catalog.jpg");
  });

  // ── R3: Ambas NULL → NULL, sin error ──────────────────────────
  it("ambas NULL: el producto queda sin imagen, el sync no falla", async () => {
    await sql`DELETE FROM productos WHERE codigo = ${TEST_CODIGO}`;

    // Insert sin imagen, sync sin imagen
    await sql`
      INSERT INTO productos (codigo, detalle)
      VALUES (${TEST_CODIGO}, 'Test producto')
      ON CONFLICT (codigo) DO NOTHING
    `;

    await upsertProductoDesdeSync(sql, { codigo: TEST_CODIGO, detalle: "Test producto", cantcaja: null, imagenUrl: null });

    const url = await getImagenUrl(TEST_CODIGO);
    expect(url).toBeNull();
  });
});


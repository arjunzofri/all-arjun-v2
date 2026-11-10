import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { productos } from "@/db/schema";

const host = (url: string | undefined) => new URL(url!).host;

describe("los tests usan una base aislada", () => {
  it("host de DATABASE_URL no es el de produccion", () => {
    expect(host(process.env.DATABASE_URL)).not.toBe(
      process.env.PROD_DATABASE_URL_HOST,
    );
  });

  it("host de DATABASE_URL es la rama test", () => {
    expect(host(process.env.DATABASE_URL)).toContain("ep-billowing-dust");
  });

  it("el modulo @/db habla con la rama y una escritura no toca produccion", async () => {
    const codigo = `TEST-AISLAMIENTO-${Date.now()}`;
    try {
      const rows = await db.execute<{ current_database: string }>(
        sql`SELECT current_database()`,
      );
      expect(rows.rows[0].current_database).toBeTruthy();

      await db.insert(productos).values({ codigo, detalle: "prueba aislada" });
      const found = await db.execute<{ codigo: string }>(
        sql`SELECT codigo FROM productos WHERE codigo = ${codigo}`,
      );
      expect(found.rows).toHaveLength(1);
    } finally {
      await db.delete(productos).where(sql`codigo = ${codigo}`);
    }
  });
});

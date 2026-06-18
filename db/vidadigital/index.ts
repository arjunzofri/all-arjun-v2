import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

let client: ReturnType<typeof drizzle> | null = null;

export function getVidaDigitalClient() {
  if (!client) {
    const sql = neon(process.env.VIDADIGITAL_DATABASE_URL!);
    // Sin schema — queries raw contra Vida Digital (solo lectura).
    client = drizzle(sql);
  }
  return client;
}

export async function healthCheck(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const c = getVidaDigitalClient();
    await c.execute("SELECT 1");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

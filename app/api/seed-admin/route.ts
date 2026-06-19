import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  const secret = process.env.SEED_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await db.execute(sql`SELECT COUNT(*)::int AS n FROM users`);
  const count = (result.rows[0] as unknown as { n: number }).n;

  if (count > 0) {
    return NextResponse.json({ ok: false, reason: "usuarios ya existen" });
  }

  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const hash = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    username,
    role: "admin",
    passwordHash: hash,
  });

  return NextResponse.json({ ok: true, username }, { status: 201 });
}

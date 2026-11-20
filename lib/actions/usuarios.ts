"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcrypt";
import { auth } from "@/lib/auth";

const crearUsuarioSchema = z.object({
  username: z.string().min(1, "Username requerido"),
  password: z.string().min(1, "Password requerido"),
  role: z.enum(["admin", "operador"]),
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

async function exigirAdmin(): Promise<void> {
  const session = await auth();
  const sessionId = session?.user?.id;
  const id = Number(sessionId);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!sessionId || !Number.isSafeInteger(id) || id <= 0 || role !== "admin") {
    throw new Error("No autorizado: solo admin puede administrar usuarios");
  }
}

export async function crearUsuario(input: CrearUsuarioInput) {
  await exigirAdmin();

  const parsed = crearUsuarioSchema.parse(input);

  const [existente] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, parsed.username));

  if (existente) {
    throw new Error("El username ya existe");
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10);

  const [created] = await db
    .insert(users)
    .values({
      username: parsed.username,
      role: parsed.role,
      passwordHash,
    })
    .returning({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    });

  return created;
}

export async function listarUsuarios() {
  await exigirAdmin();
  return db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);
}

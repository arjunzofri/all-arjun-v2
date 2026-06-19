"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcrypt";

const crearUsuarioSchema = z.object({
  username: z.string().min(1, "Username requerido"),
  password: z.string().min(1, "Password requerido"),
  role: z.enum(["admin", "operador"]),
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export async function crearUsuario(
  input: CrearUsuarioInput,
  requestUserId?: number
) {
  if (requestUserId) {
    const [actor] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, requestUserId));
    if (!actor || actor.role !== "admin") {
      throw new Error("No autorizado: solo admin puede crear usuarios");
    }
  }

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
    .returning();

  return created;
}

export async function listarUsuarios() {
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

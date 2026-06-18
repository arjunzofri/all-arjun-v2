"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcrypt";

const crearUsuarioSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Password mínimo 6 caracteres"),
  role: z.enum(["admin", "operador"]),
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export async function crearUsuario(
  input: CrearUsuarioInput,
  requestUserId?: number
) {
  // Solo admin puede crear usuarios
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

  // Verificar email único
  const [existente] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.email));

  if (existente) {
    throw new Error("El email ya existe");
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10);

  const [created] = await db
    .insert(users)
    .values({
      email: parsed.email,
      name: parsed.email.split("@")[0],
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
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);
}

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

export type UsuarioDTO = {
  id: number;
  username: string;
  role: string;
  createdAt: Date;
};

export type CrearUsuarioResult =
  | { ok: true; usuario: UsuarioDTO }
  | { ok: false; error: string };

async function exigirAdmin(): Promise<void> {
  const session = await auth();
  const sessionId = session?.user?.id;
  const id = Number(sessionId);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!sessionId || !Number.isSafeInteger(id) || id <= 0 || role !== "admin") {
    throw new Error("No autorizado: solo admin puede administrar usuarios");
  }
}

export async function crearUsuario(
  input: CrearUsuarioInput
): Promise<CrearUsuarioResult> {
  await exigirAdmin();

  const parsed = crearUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const [existente] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, parsed.data.username));

  if (existente) {
    return { ok: false, error: "El username ya existe" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const [created] = await db
    .insert(users)
    .values({
      username: parsed.data.username,
      role: parsed.data.role,
      passwordHash,
    })
    .returning({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    });

  return { ok: true, usuario: created };
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

export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { productos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { subirImagen, eliminarImagen, extraerPublicId } from "@/lib/cloudinary";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("imagen") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Imagen requerida" }, { status: 400 });
  }

  // Obtener producto actual
  const [producto] = await db
    .select({ imagenUrl: productos.imagenUrl })
    .from(productos)
    .where(eq(productos.id, Number(id)));

  if (!producto) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  // Si tiene imagen del Cloudinary de Arjun, eliminarla antes
  if (extraerPublicId(producto.imagenUrl)) {
    await eliminarImagen(producto.imagenUrl!);
  }

  // Si la imagen es de Vida Digital (dxkidwxjl), no se elimina — solo se pisa URL

  // Subir nueva imagen
  const url = await subirImagen(file);

  // Actualizar DB
  await db
    .update(productos)
    .set({ imagenUrl: url, updatedAt: new Date() })
    .where(eq(productos.id, Number(id)));

  return NextResponse.json({ imagenUrl: url });
}

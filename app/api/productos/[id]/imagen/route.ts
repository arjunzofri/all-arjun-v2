export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { productos } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { subirImagen, eliminarImagen, extraerPublicId, MAX_SIZE, ALLOWED } from "@/lib/cloudinary";
import { flagActivo } from "@/lib/feature-flags";
import { productoIdSchema } from "@/lib/validations/producto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const on = flagActivo("inventario_bodega");
  if (on && !productoIdSchema.safeParse(Number(id)).success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("imagen") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Imagen requerida" }, { status: 400 });
  }

  if (on) {
    const [producto] = await db
      .select({ imagenUrl: productos.imagenUrl })
      .from(productos)
      .where(eq(productos.id, Number(id)));

    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Formato no permitido. Usá JPEG, PNG o WebP" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Imagen demasiado grande. Máximo 10MB" }, { status: 400 });
    }

    let url: string;
    try {
      url = await subirImagen(file);
    } catch {
      return NextResponse.json({ error: "No se pudo subir la imagen. Intente nuevamente." }, { status: 502 });
    }

    const anterior = producto.imagenUrl;
    try {
      const [ok] = await db
        .update(productos)
        .set({ imagenUrl: url, updatedAt: new Date() })
        .where(and(
          eq(productos.id, Number(id)),
          anterior === null ? isNull(productos.imagenUrl) : eq(productos.imagenUrl, anterior)
        ))
        .returning({ id: productos.id });
      if (!ok) {
        try { await eliminarImagen(url); } catch { /* best-effort: la nueva puede quedar huérfana */ }
        return NextResponse.json({ error: "La imagen cambió mientras se subía. Vuelva a intentar." }, { status: 409 });
      }
    } catch {
      try { await eliminarImagen(url); } catch { /* best-effort */ }
      return NextResponse.json({ error: "No se pudo actualizar la imagen. Intente nuevamente." }, { status: 500 });
    }

    if (anterior && extraerPublicId(anterior) && anterior !== url) {
      try { await eliminarImagen(anterior); } catch { /* la respuesta no falla por el cleanup */ }
    }

    return NextResponse.json({ imagenUrl: url });
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

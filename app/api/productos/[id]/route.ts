import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProducto, updateProducto } from "@/lib/actions/productos";
import { updateProductoSchema } from "@/lib/validations";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const producto = await getProducto(Number(id));
  if (!producto) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(producto);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));

  const parsed = updateProductoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Campos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Solo se permite modificar los campos del schema — todo lo demás se ignora
  const usuarioId = (session.user as { id?: number }).id;
  const updated = await updateProducto(Number(id), parsed.data, usuarioId);

  if (!updated) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

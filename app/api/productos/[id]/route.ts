import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProducto, updateProducto } from "@/lib/actions/productos";
import { updateProductoSchema, productoIdSchema } from "@/lib/validations/producto";
import { flagActivo } from "@/lib/feature-flags";
import { getFichaInventario } from "@/lib/inventario/consultas";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = productoIdSchema.safeParse(Number(id));
  if (!parsed.success) {
    return NextResponse.json({ error: "ID de producto inválido" }, { status: 400 });
  }

  if (flagActivo("inventario_bodega")) {
    try {
      const ficha = await getFichaInventario(parsed.data);
      if (!ficha) {
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      }
      return NextResponse.json(ficha);
    } catch {
      return NextResponse.json(
        { error: "No se pudo cargar el producto. Intente nuevamente." },
        { status: 500 }
      );
    }
  }

  const producto = await getProducto(parsed.data);
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
  const parsedId = productoIdSchema.safeParse(Number(id));
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID de producto inválido" }, { status: 400 });
  }

  const body: unknown = await request.json().catch(() => ({}));

  if (flagActivo("inventario_bodega") && typeof body === "object" && body !== null &&
    Object.prototype.hasOwnProperty.call(body, "ubicacion")) {
    return NextResponse.json(
      { error: "La ubicación física se registra solo por conteo" },
      { status: 400 }
    );
  }

  const parsed = updateProductoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Campos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Solo se permite modificar los campos del schema — todo lo demás se ignora
  const updated = await updateProducto(parsedId.data, parsed.data);

  if (!updated.ok) {
    const status = updated.error === "No autorizado" ? 401 : 404;
    return NextResponse.json({ error: updated.error }, { status });
  }

  return NextResponse.json(updated.producto);
}

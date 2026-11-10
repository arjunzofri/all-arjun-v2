export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import { ErrorIdentificacion, identificarProducto } from "@/lib/identificacion/identificar";

const bodySchema = z.object({
  data: z.string().min(1).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const MAX_DATA = 1_500_000;

const ERRORES: Record<"tiempo" | "foto", { status: number; error: string }> = {
  tiempo: { status: 504, error: "La identificacion tardo demasiado. Intenta de nuevo." },
  foto: { status: 422, error: "No se pudo reconocer un producto en la foto. Intenta con otra foto." },
};

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!flagActivo("identificacion_foto")) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  let crudo: unknown;
  try { crudo = await request.json(); } catch {
    return NextResponse.json({ error: "Imagen invalida" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(crudo);
  if (!parsed.success) return NextResponse.json({ error: "Imagen invalida" }, { status: 400 });
  if (parsed.data.data.length > MAX_DATA) {
    return NextResponse.json({ error: "La foto es demasiado grande" }, { status: 413 });
  }

  try {
    return NextResponse.json(await identificarProducto(parsed.data));
  } catch (e) {
    // El mensaje crudo (posible respuesta de Gemini) nunca sale al cliente.
    console.error("[identificacion]", e);
    const mapeado = e instanceof ErrorIdentificacion && e.tipo !== "ia" ? ERRORES[e.tipo] : null;
    if (mapeado) return NextResponse.json({ error: mapeado.error }, { status: mapeado.status });
    return NextResponse.json(
      { error: "El servicio de identificacion no respondio. Intenta de nuevo." },
      { status: 502 }
    );
  }
}

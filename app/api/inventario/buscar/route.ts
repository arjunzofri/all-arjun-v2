import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import { listarInventario } from "@/lib/inventario/consultas";

export const dynamic = "force-dynamic";

const ERROR = "No se pudo buscar. Intente nuevamente.";
const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const sesion = await auth();
    const usuarioId = Number(sesion?.user?.id);
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
      return json({ error: "No autorizado" }, 401);
    }
    if (!flagActivo("inventario_bodega")) {
      return json({ error: "No encontrado" }, 404);
    }
  } catch {
    return json({ error: ERROR }, 500);
  }

  const { searchParams } = new URL(request.url);
  const claves = [...searchParams.keys()];
  if (claves.length !== 1 || claves[0] !== "q") {
    return json({ error: "Parámetros de búsqueda inválidos." }, 400);
  }
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 1 || q.length > 100) {
    return json({ error: "Parámetros de búsqueda inválidos." }, 400);
  }

  try {
    const { items } = await listarInventario({ q, limit: 12 });
    return json({ items }, 200);
  } catch {
    return json({ error: ERROR }, 500);
  }
}

import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SEGMENTO_LEGACY = ["salidas", "retornos", "transferencias", "movimientos", "bodegas", "modulos"];
const API_LEGACY = ["/api/productos", "/api/productos/por-bodega", "/api/inversion/resumen", "/api/inversion/por-codigo"];

function normalizar(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

/** Páginas legacy que se apagan con el modo inventario (nunca /productos/[id] ni /entradas/identificar). */
export function esRutaLegacy(pathname: string): boolean {
  const segmentos = normalizar(pathname).split("/").filter(Boolean);
  if (segmentos[0] === "entradas") return !(segmentos.length === 2 && segmentos[1] === "identificar");
  if (segmentos[0] === "productos") return segmentos.length === 1;
  return SEGMENTO_LEGACY.includes(segmentos[0] ?? "");
}

export async function proxy(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // Rutas públicas: auth API y assets (nunca protegidas)
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/api/seed-admin" ||
    pathname === "/api/sync/compras-anil" ||
    pathname === "/api/sync/compras-anil/cron" ||
    pathname === "/api/sync/conciliacion" ||
    pathname === "/api/identificacion"
  ) {
    return NextResponse.next();
  }

  // /login: pública sin sesión, redirige si ya hay sesión
  if (pathname === "/login") {
    if (session?.user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Proteger todas las demás rutas
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Control por rol: solo admin accede a /usuarios
  const role = (session.user as { role?: string }).role;
  if (pathname === "/usuarios" && role !== "admin") {
    return new NextResponse("No autorizado", { status: 403 });
  }

  // Modo inventario ON: apaga páginas y APIs legacy. OFF: comportamiento intacto.
  if (flagActivo("inventario_bodega")) {
    const ruta = normalizar(pathname);
    if (esRutaLegacy(pathname) || API_LEGACY.includes(ruta)) {
      // API o mutación: 404 (nunca reenviar un POST a /inventario)
      if (ruta.startsWith("/api/") || request.method !== "GET") {
        return NextResponse.json({ error: "No disponible" }, { status: 404 });
      }
      return NextResponse.redirect(new URL("/inventario", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest\\.json$|icon-192\\.png$|icon-512\\.png$).*)"],
};

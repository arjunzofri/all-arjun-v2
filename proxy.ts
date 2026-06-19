import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // Rutas públicas: auth API y assets (nunca protegidas)
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/api/seed-admin" ||
    pathname === "/api/sync/compras-anil"
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

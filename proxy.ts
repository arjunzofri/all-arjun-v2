import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // Rutas públicas: auth API y assets
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  if (!session?.user) {
    if (pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // Con sesión: / → /dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
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

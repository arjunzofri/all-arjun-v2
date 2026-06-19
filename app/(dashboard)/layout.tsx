import Link from "next/link";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
  { href: "/entradas", label: "Entradas" },
  { href: "/salidas", label: "Salidas" },
  { href: "/retornos", label: "Retornos" },
  { href: "/bodegas", label: "Bodegas" },
  { href: "/modulos", label: "Módulos" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/usuarios", label: "Usuarios" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-gray-50 px-4 py-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-500">NAVEGACIÓN</h2>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

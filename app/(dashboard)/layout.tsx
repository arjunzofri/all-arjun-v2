import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/dashboard/productos", label: "Productos" },
  { href: "/dashboard/entradas", label: "Entradas" },
  { href: "/dashboard/salidas", label: "Salidas" },
  { href: "/dashboard/bodegas", label: "Bodegas" },
  { href: "/dashboard/modulos", label: "Módulos" },
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

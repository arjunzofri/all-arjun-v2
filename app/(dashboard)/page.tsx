import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getBodegas, getModulos } from "@/lib/actions/vistas";
import Link from "next/link";

export const dynamic = "force-dynamic";

function StatCard({
  href,
  nombre,
  total,
  tipo,
}: {
  href: string;
  nombre: string;
  total: number;
  tipo: "bodega" | "modulo";
}) {
  const color = tipo === "bodega" ? "bg-violet-600" : "bg-slate-700";
  const label = tipo === "bodega" ? "bodega" : "modulo";

  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-violet-300 transition-all overflow-hidden"
    >
      <div className={`h-1.5 w-full ${color}`} />
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
            <h3 className="text-base font-semibold text-slate-800 group-hover:text-violet-700 transition-colors leading-tight">
              {nombre}
            </h3>
          </div>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0 mt-0.5 text-slate-300 group-hover:text-violet-400 transition-colors">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
        <div>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">
            {total.toLocaleString("es-CL")}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">unidades en stock</p>
        </div>
      </div>
    </Link>
  );
}

function SectionHeader({ title, href, count }: { title: string; href: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      <Link
        href={href}
        className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
      >
        Ver todas ({count})
      </Link>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as { username?: string } | undefined;
  const [bodegas, modulos] = await Promise.all([getBodegas(), getModulos()]);

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bienvenido, <span className="font-medium text-slate-700">{user?.username ?? "---"}</span>
        </p>
      </div>

      {/* Bodegas */}
      <div>
        <SectionHeader title="Bodegas" href="/bodegas" count={bodegas.length} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bodegas.map((b) => (
            <StatCard
              key={b.id}
              href={`/bodegas/${b.id}`}
              nombre={b.nombre}
              total={b.totalStock}
              tipo="bodega"
            />
          ))}
        </div>
      </div>

      {/* Modulos */}
      <div>
        <SectionHeader title="Modulos" href="/modulos" count={modulos.length} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modulos.map((m) => (
            <StatCard
              key={m.id}
              href={`/modulos/${m.id}`}
              nombre={m.nombre}
              total={m.totalStock}
              tipo="modulo"
            />
          ))}
        </div>
      </div>

      {/* Accesos rapidos */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Accesos rapidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/entradas",    label: "Nueva entrada",  icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12", color: "text-green-600 bg-green-50 border-green-200 hover:bg-green-100" },
            { href: "/salidas",     label: "Nueva salida",   icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4 4l4-4m0 0l-4-4m4 4H4",    color: "text-red-600 bg-red-50 border-red-200 hover:bg-red-100" },
            { href: "/retornos",    label: "Nuevo retorno",  icon: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6",                          color: "text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100" },
            { href: "/movimientos", label: "Movimientos",    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", color: "text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100" },
          ].map(({ href, label, icon, color }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${color}`}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                <path d={icon} />
              </svg>
              {label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import BuscadorInventario from "@/components/inventario/BuscadorInventario";
import { useBodegaTrabajo } from "@/components/inventario/useBodegaTrabajo";
import { limpiarBorradoresConteo } from "@/components/inventario/borradoresConteoStore";

const enlace = "rounded-md px-2 py-1 text-slate-600 hover:bg-violet-50 hover:text-violet-700";

export default function InventarioShell({ userId, username, esAdmin, children }: {
  userId: string; username: string; esAdmin: boolean; children?: React.ReactNode;
}) {
  const ruta = usePathname();
  const { bodegaTrabajo, fijarBodegaTrabajo, limpiarBodegaTrabajo } = useBodegaTrabajo(userId);
  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-xs font-bold text-white">A</span>Arjun</Link>
          <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            <Link href="/inventario" className={enlace}>Inventario</Link>
            {esAdmin && <Link href="/usuarios" className={enlace}>Usuarios</Link>}
          </nav>
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">{username}</span>
            <LogoutButton variant="light" onBeforeSignOut={() => { limpiarBodegaTrabajo(); limpiarBorradoresConteo(userId); }} />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-2 sm:px-6">
          <label className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
            Estoy contando en
            <select
              value={bodegaTrabajo ?? ""}
              onChange={(e) => fijarBodegaTrabajo(e.target.value === "" ? null : (Number(e.target.value) as 1 | 2))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
            >
              <option value="">Elegir bodega</option>
              <option value="1">Bodega 1</option>
              <option value="2">Bodega 2</option>
            </select>
          </label>
          {ruta !== "/" && <div className="min-w-0 flex-1 basis-64"><BuscadorInventario /></div>}
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

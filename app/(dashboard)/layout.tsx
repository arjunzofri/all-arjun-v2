import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import DashboardShell from "@/components/DashboardShell";
import InventarioShell from "@/components/inventario/InventarioShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const usuario = session?.user as { id?: string; username?: string; role?: string } | undefined;
  if (flagActivo("inventario_bodega")) {
    return <InventarioShell userId={String(usuario?.id ?? "")} username={usuario?.username ?? "---"} esAdmin={usuario?.role === "admin"}>{children}</InventarioShell>;
  }
  const role = usuario?.role;
  const showInversion =
    role === "admin" && flagActivo("inversion_mercaderia");
  const showIdentificacion = flagActivo("identificacion_foto");
  const showUsuarios = role === "admin";

  return (
    <DashboardShell showIdentificacion={showIdentificacion} showInversion={showInversion} showUsuarios={showUsuarios}>
      {children}
    </DashboardShell>
  );
}

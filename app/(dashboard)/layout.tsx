import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
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

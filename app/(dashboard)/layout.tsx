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

  return (
    <DashboardShell showInversion={showInversion}>{children}</DashboardShell>
  );
}

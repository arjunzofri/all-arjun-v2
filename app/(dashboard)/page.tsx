import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as { username?: string } | undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-sm text-gray-500">
        Sesión activa: {user?.username ?? "—"}
      </p>
    </div>
  );
}

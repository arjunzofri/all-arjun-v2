import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-sm text-gray-500">
        Sesión activa: {session?.user?.email ?? "—"}
      </p>
    </div>
  );
}

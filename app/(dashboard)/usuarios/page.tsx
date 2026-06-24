"use client";

import { useState, useEffect } from "react";
import { crearUsuario, listarUsuarios } from "@/lib/actions/usuarios";

type Usuario = {
  id: number;
  username: string;
  role: string;
  createdAt: Date;
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "operador">("operador");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const cargar = async () => {
    const lista = await listarUsuarios();
    setUsuarios(lista as Usuario[]);
  };

  useEffect(() => {
    cargar();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk("");

    try {
      await crearUsuario({ username: username.trim(), password, role });
      setOk(`Usuario ${username} creado`);
      setUsername("");
      setPassword("");
      setRole("operador");
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Usuarios</h1>

      <div className="mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="py-2">Usuario</th>
              <th className="py-2">Rol</th>
              <th className="py-2">Creado</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-2">{u.username}</td>
                <td className="py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      u.role === "admin"
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="py-3 text-slate-500 text-sm">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold text-slate-900 mb-4">
        Nuevo usuario
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition"
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "operador")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition"
        >
          <option value="operador">Operador</option>
          <option value="admin">Admin</option>
        </select>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-green-600">{ok}</p>}

        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
        >
          Crear usuario
        </button>
      </form>
    </div>
  );
}


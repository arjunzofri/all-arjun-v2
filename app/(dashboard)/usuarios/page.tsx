"use client";

import { useState, useEffect } from "react";
import { crearUsuario, listarUsuarios } from "@/lib/actions/usuarios";

type Usuario = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [email, setEmail] = useState("");
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
      await crearUsuario({ email: email.trim(), password, role });
      setOk(`Usuario ${email} creado`);
      setEmail("");
      setPassword("");
      setRole("operador");
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Usuarios</h1>

      {/* Listado */}
      <div className="mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">Email</th>
              <th className="py-2">Rol</th>
              <th className="py-2">Creado</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="py-2">{u.email}</td>
                <td className="py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      u.role === "admin"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="py-2 text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-gray-400 text-center">
                  Sin usuarios
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Formulario crear */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Nuevo usuario
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (mín. 6)"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          minLength={6}
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "operador")}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="operador">Operador</option>
          <option value="admin">Admin</option>
        </select>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-green-600">{ok}</p>}

        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Crear usuario
        </button>
      </form>
    </div>
  );
}

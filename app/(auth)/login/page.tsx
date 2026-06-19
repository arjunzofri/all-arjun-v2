"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Ingresá usuario y contraseña");
      return;
    }

    const result = await signIn("credentials", {
      username: username.trim(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Usuario o contraseña inválidos");
    } else {
      window.location.href = "/";
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-8 shadow"
      >
        <h1 className="mb-6 text-2xl font-bold text-gray-900">
          App Arjun v2
        </h1>

        <label className="mb-2 block text-sm text-gray-700" htmlFor="username">
          Usuario
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          autoFocus
        />

        <label className="mb-2 block text-sm text-gray-700" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="w-full rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Ingresar
        </button>
      </form>
    </main>
  );
}

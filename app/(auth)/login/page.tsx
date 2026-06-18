"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
// ponytail: form inline sin librería de validación — solo email no vacío.

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Ingresá un email");
      return;
    }

    const result = await signIn("credentials", {
      email: email.trim(),
      password: ".",
      redirect: false,
    });

    if (result?.error) {
      setError("Credenciales inválidas");
    } else {
      window.location.href = "/dashboard";
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
        <label className="mb-2 block text-sm text-gray-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="usuario@arjun.cl"
          autoFocus
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

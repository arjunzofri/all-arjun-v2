"use client";

import { signOut as nextAuthSignOut } from "next-auth/react";
import { useRef, useState } from "react";

/**
 * Lógica pura del handler de logout — exportada para test sin jsdom.
 *
 * useRef (vía isPending/setPending) provee la guarda síncrona
 * que frena el doble-click antes de que React re-renderice.
 * useState maneja disabled={pending} para el feedback visual.
 */
export async function createLogoutHandler(
  signOutFn: (opts?: Record<string, unknown>) => Promise<unknown>,
  isPending: () => boolean,
  setPending: (v: boolean) => void,
) {
  if (isPending()) return;
  setPending(true);
  try {
    await signOutFn({ redirectTo: "/login" });
  } finally {
    setPending(false);
  }
}

export default function LogoutButton() {
  const pendingRef = useRef(false);
  const [pending, setPendingState] = useState(false);

  const setPending = (v: boolean) => {
    pendingRef.current = v;
    setPendingState(v);
  };

  const handleLogout = () =>
    createLogoutHandler(nextAuthSignOut, () => pendingRef.current, setPending);

  return (
    <button
      onClick={handleLogout}
      disabled={pending}
      className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      Cerrar sesión
    </button>
  );
}

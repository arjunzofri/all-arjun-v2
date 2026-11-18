"use client";

import { signOut as nextAuthSignOut } from "next-auth/react";
import { useRef, useState } from "react";

export async function createLogoutHandler(
  signOutFn: (opts?: Record<string, unknown>) => Promise<unknown>,
  isPending: () => boolean,
  setPending: (v: boolean) => void,
  onBeforeSignOut?: () => unknown,
) {
  if (isPending()) return;
  setPending(true);
  try {
    if (onBeforeSignOut) { try { await onBeforeSignOut(); } catch { /* signOut igual corre */ } }
    await signOutFn({ redirectTo: "/login" });
  } finally {
    setPending(false);
  }
}

export default function LogoutButton({ variant, onBeforeSignOut }: {
  variant?: "light"; onBeforeSignOut?: () => void;
} = {}) {
  const pendingRef = useRef(false);
  const [pending, setPendingState] = useState(false);

  const setPending = (v: boolean) => {
    pendingRef.current = v;
    setPendingState(v);
  };

  const handleLogout = () =>
    createLogoutHandler(nextAuthSignOut, () => pendingRef.current, setPending, onBeforeSignOut);

  return (
    <button
      onClick={handleLogout}
      disabled={pending}
      className={variant === "light" ? "inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors disabled:opacity-50" : "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      {pending ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}

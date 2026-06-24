"use client";

import { useRef } from "react";

type Props = {
  onFoto: (file: File) => void;
  disabled?: boolean;
  className?: string;
};

export function CamaraBoton({ onFoto, disabled, className = "" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFoto(file);
    // Reset para permitir seleccionar la misma foto de nuevo
    e.target.value = "";
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={disabled}
      title="Tomar o subir foto"
      className={`inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
    </button>
  );
}
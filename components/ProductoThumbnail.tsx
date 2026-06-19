"use client";

type ThumbnailSize = "sm" | "lg";

const SIZE_CLASSES: Record<
  ThumbnailSize,
  { img: string; fallback: string }
> = {
  sm: {
    img: "w-8 h-8 rounded object-cover shrink-0 bg-gray-100",
    fallback:
      "w-8 h-8 rounded bg-gray-100 shrink-0 flex items-center justify-center text-gray-400 text-xs",
  },
  lg: {
    img: "w-24 h-24 rounded object-cover bg-gray-100",
    fallback:
      "w-24 h-24 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-sm",
  },
};

// ── Lógica pura de configuración (exportada para test sin jsdom) ──────

export function resolveThumbnailConfig(
  size: ThumbnailSize,
  fallbackText?: string,
) {
  const base = SIZE_CLASSES[size];
  return {
    imgClass: base.img,
    fallbackClass: base.fallback,
    fallbackText: fallbackText ?? (size === "sm" ? "—" : "Sin imagen"),
  };
}

// ── Componente ────────────────────────────────────────────────────────

type ProductoThumbnailProps = {
  src: string | null;
  alt: string;
  size: ThumbnailSize;
  fallbackText?: string;
  onError?: () => void;
};

export function ProductoThumbnail({
  src,
  alt,
  size,
  fallbackText,
  onError,
}: ProductoThumbnailProps) {
  const config = resolveThumbnailConfig(size, fallbackText);

  if (!src) {
    return <div className={config.fallbackClass}>{config.fallbackText}</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={config.imgClass}
      onError={
        onError
          ? () => onError()
          : (e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }
      }
    />
  );
}

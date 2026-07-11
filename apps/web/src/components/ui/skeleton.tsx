import type { HTMLAttributes } from "react";

/**
 * Tonos disponibles para el esqueleto de carga.
 * - `strong`: relleno gris marcado (títulos, valores).
 * - `soft`: relleno gris tenue (textos secundarios).
 * - `card`: tarjeta con borde y fondo, para placeholders de bloques.
 * - `none`: sin fondo; el color lo define `className` (casos especiales).
 */
export type SkeletonTone = "strong" | "soft" | "card" | "none";

const TONE_CLASSES: Record<SkeletonTone, string> = {
  strong: "bg-gray-200 dark:bg-white/10",
  soft: "bg-gray-100 dark:bg-white/5",
  card: "border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]",
  none: "",
};

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /** Tono del relleno. Por defecto `strong`. */
  tone?: SkeletonTone;
};

/**
 * Bloque de carga (skeleton) reutilizable. Aporta `animate-pulse` y el color
 * del tono; el tamaño y el redondeo se pasan por `className`
 * (ej: `h-4 w-24 rounded`).
 */
export function Skeleton({ tone = "strong", className = "", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`animate-pulse ${TONE_CLASSES[tone]} ${className}`.trim()}
      {...props}
    />
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  /** Ícono (componente de lucide-react). Opcional. */
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /**
   * Tamaño visual:
   * - `sm`: tarjeta compacta (listados dentro de una vista).
   * - `lg`: tarjeta destacada (secciones vacías de página completa).
   */
  size?: "sm" | "lg";
  /** Si se pasa `href`, el botón navega. Requiere `action` como etiqueta. */
  href?: string;
  /** Etiqueta del botón (con `href` o con `onAction`). */
  action?: string;
  /** Si se pasa `onAction`, el botón ejecuta la acción (ej: limpiar filtros). */
  onAction?: () => void;
  /** Clases extra para el contenedor. */
  className?: string;
};

/**
 * Estado vacío reutilizable: ícono + título + descripción + botón opcional.
 * Unifica los distintos "no hay nada acá" del producto en un solo componente.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  size = "sm",
  href,
  action,
  onAction,
  className = "",
}: EmptyStateProps) {
  const isLarge = size === "lg";

  const container = isLarge
    ? "min-h-[360px] rounded-[28px] bg-white/70 px-6 py-16 dark:bg-white/[0.03]"
    : "min-h-[340px] rounded-2xl px-6 py-12";

  const iconBadge = isLarge
    ? "h-16 w-16 ring-1 ring-accent-100 dark:ring-accent-300/15"
    : "h-14 w-14";

  const titleClass = isLarge
    ? "text-3xl font-bold leading-tight text-foreground md:text-4xl"
    : "text-lg font-bold text-foreground";

  const button = action && (href || onAction);

  return (
    <div
      className={`flex flex-col items-center justify-center border border-dashed border-gray-200 text-center dark:border-white/15 ${container} ${className}`.trim()}
    >
      {Icon && (
        <span
          className={`flex items-center justify-center rounded-2xl bg-accent-50 text-accent-700 dark:bg-accent-300/10 dark:text-accent-100 ${iconBadge}`}
        >
          <Icon className="h-7 w-7" strokeWidth={1.6} />
        </span>
      )}
      <h3 className={`${Icon ? "mt-5" : ""} ${titleClass}`.trim()}>{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}
      {button &&
        (href ? (
          <Link
            href={href}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
          >
            {action}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200"
          >
            {action}
          </button>
        ))}
    </div>
  );
}

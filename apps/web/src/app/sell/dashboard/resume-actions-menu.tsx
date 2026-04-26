"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";

interface ResumeActionsMenuProps {
  resumeId: string;
  resumeTitle: string;
}

const MENU_ITEMS = [
  { label: "Gestionar precio",          href: (id: string) => `/sell/${id}/price`  },
  { label: "Cambiar nombre",            href: (id: string) => `/sell/${id}/rename` },
  { label: "Cambiar fotos",             href: (id: string) => `/sell/${id}/photos` },
  { label: "Ir a la página del apunte", href: (id: string) => `/resume/${id}`      },
] as const;

export function ResumeActionsMenu({ resumeId, resumeTitle }: ResumeActionsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Cierre al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Cierre con Escape + navegación con flechas y Enter
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const focused = itemRefs.current.findIndex((el) => el === document.activeElement);
        const next = (focused + 1) % MENU_ITEMS.length;
        itemRefs.current[next]?.focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const focused = itemRefs.current.findIndex((el) => el === document.activeElement);
        const prev = (focused - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
        itemRefs.current[prev]?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Foco en el primer ítem cuando se abre
  useEffect(() => {
    if (open) {
      // Pequeño timeout para que el DOM esté listo
      const t = setTimeout(() => itemRefs.current[0]?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  function handleSelect(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Opciones para ${resumeTitle}`}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500"
      >
        <MoreVertical size={18} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Opciones para ${resumeTitle}`}
          className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-gray-100 bg-white py-1 shadow-[0_4px_20px_rgba(0,0,0,0.10)]"
        >
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => { itemRefs.current[i] = el; }}
              role="menuitem"
              type="button"
              tabIndex={-1}
              onClick={() => handleSelect(item.href(resumeId))}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

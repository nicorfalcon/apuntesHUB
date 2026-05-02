"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { StarRating } from "@/components/ui/star-rating";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { TocItem } from "@/components/ui/pdf-viewer";

// Dynamic import — react-pdf solo funciona en el cliente
const PdfViewer = dynamic(
  () => import("@/components/ui/pdf-viewer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-600 border-t-transparent" />
      </div>
    ),
  }
);

// ─── Iconos ───────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 3 3 3 3 8" />
      <polyline points="21 8 21 3 16 3" />
      <polyline points="3 16 3 21 8 21" />
      <polyline points="16 21 21 21 21 16" />
      <line x1="3" y1="3" x2="10" y2="10" />
      <line x1="21" y1="21" x2="14" y2="14" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// ─── TOC (Tabla de contenidos) ────────────────────────────────────────────────

function TocList({
  items,
  currentPage,
  onNavigate,
  depth = 0,
}: {
  items: TocItem[];
  currentPage: number;
  onNavigate: (page: number) => void;
  depth?: number;
}) {
  return (
    <>
      {items.map((item, i) => {
        const isActive = currentPage === item.page;
        return (
          <div key={i}>
            <button
              onClick={() => onNavigate(item.page)}
              className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                isActive
                  ? "bg-accent-100 text-accent-800"
                  : "text-gray-500 hover:bg-gray-100 hover:text-foreground"
              }`}
              style={{ paddingLeft: `${10 + depth * 14}px` }}
            >
              <span
                className={`mt-0.5 shrink-0 font-mono text-[10px] font-semibold tabular-nums ${
                  isActive ? "text-accent-600" : "text-gray-400"
                }`}
              >
                {String(item.page).padStart(3, "0")}
              </span>
              <span
                className={`text-xs leading-snug ${
                  isActive ? "font-semibold" : "font-normal"
                }`}
              >
                {item.title}
              </span>
            </button>
            {item.items.length > 0 && (
              <TocList
                items={item.items}
                currentPage={currentPage}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ViewerLayoutProps {
  pdfUrl: string;
  userEmail: string;
  userDisplayName: string;
  userAvatarUrl: string | null;
  resume: {
    title: string;
    subject: string;
    university: string;
    career: string;
    description: string | null;
    updated_at: string;
  };
  seller: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    resume_count: number;
  };
  ratingAvg: number;
  ratingCount: number;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ViewerLayout({
  pdfUrl,
  userEmail,
  userDisplayName,
  userAvatarUrl,
  resume,
  seller,
  ratingAvg,
  ratingCount,
}: ViewerLayoutProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [numPages, setNumPages] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  // null = todavía cargando; [] = sin índice; [...] = índice disponible
  const [outline, setOutline] = useState<TocItem[] | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const goTo = useCallback(
    (p: number) => {
      const clamped = Math.max(1, Math.min(numPages || 1, p));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
    },
    [numPages]
  );

  const handleNumPagesLoad = useCallback((n: number) => {
    setNumPages(n);
  }, []);

  const handleOutlineLoad = useCallback((items: TocItem[]) => {
    setOutline(items);
  }, []);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
    const v = parseInt(e.target.value);
    if (!isNaN(v)) goTo(v);
  };

  const handlePageInputBlur = () => {
    setPageInput(String(currentPage));
  };

  const userInitials = userDisplayName
    ? userDisplayName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const sellerInitials = seller.display_name
    ? seller.display_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const updatedDate = new Date(resume.updated_at).toLocaleDateString("es-AR", {
    month: "short",
    year: "numeric",
  });

  const readPercent = numPages > 0 ? Math.round((currentPage / numPages) * 100) : 0;

  const hasOutline = outline !== null && outline.length > 0;
  const outlineLoading = outline === null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-body">
      {/* ── Navbar del visor ── */}
      <nav className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-white/10 dark:bg-[#101816]">
        <div className="flex items-center gap-4">
          <Link href="/browse" className="text-lg font-bold tracking-tight text-foreground">
            apuntes<span className="text-accent-600">HUB</span>
          </Link>
          <div className="h-5 w-px bg-gray-200" />
          <Link
            href="/my-purchases"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-foreground"
          >
            <ArrowLeftIcon />
            Mis apuntes
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          <div className="hidden h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent-600 to-accent-800 text-xs font-semibold text-white md:flex">
            {userAvatarUrl ? (
              <Image
                src={userAvatarUrl}
                alt={userDisplayName}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              userInitials
            )}
          </div>
        </div>
      </nav>

      {/* ── Contenido principal ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
          {/* Info del apunte */}
          <div className="shrink-0 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-md bg-accent-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
                Comprado
              </span>
              <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <span className="text-accent-600">
                  <ShieldIcon />
                </span>
                Protegido
              </span>
            </div>

            <h1 className="text-lg font-bold leading-snug tracking-tight text-foreground">
              {resume.title}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {resume.subject} · {resume.university}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {numPages > 0 ? `${numPages} páginas · ` : ""}Actualizado {updatedDate}
            </p>

            {(ratingAvg > 0 || ratingCount > 0) && (
              <div className="mt-3">
                <StarRating rating={ratingAvg} count={ratingCount} />
              </div>
            )}
          </div>

          <div className="mx-5 h-px shrink-0 bg-gray-100" />

          {/* Vendedor */}
          <div className="shrink-0 p-5">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Vendedor
            </p>
            <Link
              href={`/profile/${seller.id}`}
              className="flex items-center gap-2.5 rounded-xl p-2 -mx-2 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-accent-600 to-accent-800 text-sm font-bold text-white">
                {seller.avatar_url ? (
                  <Image
                    src={seller.avatar_url}
                    alt={seller.display_name}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-xl object-cover"
                  />
                ) : (
                  sellerInitials
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{seller.display_name}</p>
                <p className="text-xs text-gray-400">
                  {seller.resume_count}{" "}
                  {seller.resume_count === 1 ? "apunte publicado" : "apuntes publicados"}
                </p>
              </div>
            </Link>
          </div>

          <div className="mx-5 h-px shrink-0 bg-gray-100" />

          {/* ── Sección de contenido (TOC / descripción) ── */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-5 pb-2 pt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Contenido
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {/* TOC cargando */}
              {outlineLoading && (
                <div className="space-y-1.5 px-2 pt-1">
                  {[80, 60, 70, 55, 65].map((w, i) => (
                    <div
                      key={i}
                      className="h-3 animate-pulse rounded bg-gray-100"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              )}

              {/* TOC con entradas */}
              {hasOutline && (
                <TocList
                  items={outline!}
                  currentPage={currentPage}
                  onNavigate={goTo}
                />
              )}

              {/* Sin TOC: mostrar descripción o mensaje */}
              {!outlineLoading && !hasOutline && (
                <>
                  {resume.description ? (
                    <p className="px-2 text-sm leading-relaxed text-gray-500">
                      {resume.description}
                    </p>
                  ) : (
                    <p className="px-2 text-xs text-gray-400">
                      Este apunte no tiene índice disponible.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Aviso de seguridad */}
          <div className="m-4 shrink-0 rounded-xl border border-accent-200 bg-accent-50 p-3.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-accent-700">
              <ShieldIcon />
              <span className="text-xs font-semibold">Contenido protegido</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-500">
              Marca de agua dinámica vinculada a tu cuenta. Descarga y captura deshabilitadas.
            </p>
          </div>
        </aside>

        {/* ── Área del visor ── */}
        <main
          className="relative flex flex-1 flex-col items-center overflow-auto bg-stone-200 py-8"
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Toolbar flotante */}
          <div className="sticky top-0 z-20 mb-6 flex items-center gap-1.5 rounded-2xl bg-white/85 px-3 py-2 shadow-[0_2px_20px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] backdrop-blur-md">
            {/* Anterior */}
            <button
              onClick={() => goTo(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Página anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-gray-100 disabled:cursor-default disabled:opacity-30"
            >
              <ChevronLeftIcon />
            </button>

            {/* Indicador de página */}
            <div className="flex items-center gap-1.5 px-1">
              <input
                type="text"
                inputMode="numeric"
                value={pageInput}
                onChange={handlePageInputChange}
                onBlur={handlePageInputBlur}
                className="h-7 w-10 rounded-lg border border-gray-200 bg-background text-center text-sm font-semibold text-foreground outline-none focus:border-accent-600"
              />
              <span className="text-sm font-medium text-gray-400">
                de {numPages || "—"}
              </span>
            </div>

            {/* Siguiente */}
            <button
              onClick={() => goTo(currentPage + 1)}
              disabled={currentPage >= numPages}
              aria-label="Página siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-gray-100 disabled:cursor-default disabled:opacity-30"
            >
              <ChevronRightIcon />
            </button>

            <div className="mx-1 h-5 w-px bg-gray-200" />

            {/* Zoom − */}
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              aria-label="Reducir zoom"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-foreground transition-colors hover:bg-gray-100"
            >
              <ZoomOutIcon />
            </button>
            <span className="min-w-[38px] text-center text-xs font-semibold text-foreground">
              {zoom}%
            </span>
            {/* Zoom + */}
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              aria-label="Aumentar zoom"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-foreground transition-colors hover:bg-gray-100"
            >
              <ZoomInIcon />
            </button>

            <div className="mx-1 h-5 w-px bg-gray-200" />

            {/* Pantalla completa / salir */}
            <button
              onClick={() =>
                isFullscreen
                  ? document.exitFullscreen?.()
                  : document.documentElement.requestFullscreen?.()
              }
              aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-foreground transition-colors hover:bg-gray-100"
            >
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </div>

          {/* Visor PDF */}
          <PdfViewer
            url={pdfUrl}
            userEmail={userEmail}
            page={currentPage}
            onPageChange={goTo}
            zoom={zoom}
            onNumPagesLoad={handleNumPagesLoad}
            onOutlineLoad={handleOutlineLoad}
          />

          {/* Barra de progreso */}
          <div className="mt-5 flex items-center gap-3">
            <div className="h-1 w-48 overflow-hidden rounded-full bg-gray-300">
              <div
                className="h-full rounded-full bg-accent-600 transition-[width] duration-300"
                style={{ width: `${readPercent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-400">{readPercent}% leído</span>
          </div>

          <div className="h-8" />
        </main>
      </div>
    </div>
  );
}

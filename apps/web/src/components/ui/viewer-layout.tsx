"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { GripVertical, Menu, MessageCircleQuestion, X } from "lucide-react";
import { StarRating } from "@/components/ui/star-rating";
import { AiChatPanel } from "@/components/ui/ai-chat-panel";
import { MaterialQuestionsPanel } from "@/components/material-questions";
import { ResumeTopicsSection } from "@/components/resume/resume-topics";
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

const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_DEFAULT_WIDTH = 288;
const SIDEBAR_MAX_RATIO = 1 / 4;

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
                  ? "bg-accent-100 text-accent-800 dark:bg-accent-300/15 dark:text-accent-100"
                  : "text-gray-500 hover:bg-gray-100 hover:text-foreground dark:text-sand-300/70 dark:hover:bg-white/[0.06] dark:hover:text-sand-50"
              }`}
              style={{ paddingLeft: `${10 + depth * 14}px` }}
            >
              <span
                className={`mt-0.5 shrink-0 font-mono text-[10px] font-semibold tabular-nums ${
                  isActive
                    ? "text-accent-600 dark:text-accent-100"
                    : "text-gray-400 dark:text-sand-300/45"
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
  resumeId: string;
  userEmail: string;
  userDisplayName: string;
  userAvatarUrl: string | null;
  resume: {
    title: string;
    subject: string;
    university: string;
    career: string;
    description: string | null;
    topics?: string[] | null;
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
  aiReady: boolean;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ViewerLayout({
  pdfUrl,
  resumeId,
  userEmail,
  userDisplayName,
  userAvatarUrl,
  resume,
  seller,
  ratingAvg,
  ratingCount,
  aiReady,
}: ViewerLayoutProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [numPages, setNumPages] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  // null = todavía cargando; [] = sin índice; [...] = índice disponible
  const [outline, setOutline] = useState<TocItem[] | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toolsPanel, setToolsPanel] = useState<"consultas" | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);

  const clampSidebarWidth = useCallback((width: number) => {
    if (typeof window === "undefined") return width;
    const maxWidth = Math.max(SIDEBAR_MIN_WIDTH, window.innerWidth * SIDEBAR_MAX_RATIO);
    return Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), maxWidth);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setSidebarWidth((width) => clampSidebarWidth(width));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampSidebarWidth]);

  const startSidebarResize = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      resizeStartRef.current = { x: event.clientX, width: sidebarWidth };
      setIsResizingSidebar(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [sidebarWidth]
  );

  const moveSidebarResize = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!resizeStartRef.current) return;
      const delta = event.clientX - resizeStartRef.current.x;
      setSidebarWidth(clampSidebarWidth(resizeStartRef.current.width + delta));
    },
    [clampSidebarWidth]
  );

  const stopSidebarResize = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    resizeStartRef.current = null;
    setIsResizingSidebar(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 640) {
      setZoom(55);
    } else if (window.innerWidth < 1024) {
      setZoom(85);
    }
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizingSidebar]);

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

  const closeToolsPanel = useCallback(() => {
    setToolsPanel(null);
  }, []);

  return (
    <div className="flex h-[100svh] flex-col overflow-hidden bg-background font-body">
      {/* ── Navbar del visor ── */}
      <nav className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3 dark:border-white/10 dark:bg-[#101816] sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Abrir panel del apunte"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-muted-foreground transition-colors hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700 dark:border-white/10 dark:hover:border-accent-300/25 dark:hover:bg-accent-300/10 dark:hover:text-accent-100 lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link href="/explorar" className="shrink-0 text-base font-bold tracking-tight text-foreground sm:text-lg">
            apuntes<span className="text-accent-600">HUB</span>
          </Link>
          <div className="hidden h-5 w-px bg-gray-200 sm:block dark:bg-white/10" />
          <Link
            href="/my-purchases"
            className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 dark:text-sand-300/75 dark:hover:bg-white/10 dark:hover:text-sand-50 dark:focus-visible:ring-accent-300/30 sm:px-2.5"
          >
            <ArrowLeftIcon />
            <span className="hidden sm:inline">Mi biblioteca</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
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
      <div className="relative flex flex-1 overflow-hidden">
        {isSidebarOpen && (
          <button
            type="button"
            aria-label="Cerrar panel del apunte"
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 top-14 z-30 bg-[#06110e]/45 backdrop-blur-[1px] lg:hidden"
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={`fixed bottom-0 left-0 top-14 z-40 flex w-[min(88vw,22rem)] shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-white/10 dark:bg-[#101816] lg:static lg:z-auto lg:w-[var(--viewer-sidebar-width)] lg:translate-x-0 lg:shadow-none lg:transition-none ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={
            {
              "--viewer-sidebar-width": `${sidebarWidth}px`,
            } as React.CSSProperties
          }
        >
          {/* Info del apunte */}
          <div className="shrink-0 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Panel del apunte
              </p>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Cerrar panel del apunte"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground dark:hover:bg-white/[0.06]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-md bg-accent-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent-700 dark:bg-accent-300/10 dark:text-accent-100">
                Comprado
              </span>
              <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-300/10 dark:text-amber-100">
                <span className="text-accent-600 dark:text-accent-100">
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

            <ResumeTopicsSection
              topics={resume.topics}
              className="mt-4"
              headingClassName="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-sand-300/65"
            />
          </div>

          <div className="mx-5 h-px shrink-0 bg-gray-100 dark:bg-white/10" />

          {/* Vendedor */}
          <div className="shrink-0 p-5">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Vendedor
            </p>
            <Link
              href={`/profile/${seller.id}`}
              className="flex items-center gap-2.5 rounded-xl p-2 -mx-2 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.06]"
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

          <div className="mx-5 h-px shrink-0 bg-gray-100 dark:bg-white/10" />

          {/* ── Sección de contenido ── */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-5 pb-3 pt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-sand-300/65">
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
                    <p className="px-2 text-sm leading-relaxed text-gray-500 dark:text-sand-300/75">
                      {resume.description}
                    </p>
                  ) : (
                    <p className="px-2 text-xs text-gray-400 dark:text-sand-300/60">
                      Este apunte no tiene índice disponible.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Aviso de seguridad */}
          <div className="m-4 shrink-0 rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="mb-1 flex items-center gap-1.5 text-gray-600 dark:text-sand-100">
              <ShieldIcon />
              <span className="text-xs font-semibold">Contenido protegido</span>
            </div>
            <p className="text-[11px] leading-5 text-gray-500 dark:text-sand-300/75">
              Marca de agua activa. Evitá compartir capturas o descargas.
            </p>
          </div>
        </aside>

        <button
          type="button"
          aria-label="Cambiar ancho del panel"
          title="Arrastrar para cambiar el ancho"
          onPointerDown={startSidebarResize}
          onPointerMove={moveSidebarResize}
          onPointerUp={stopSidebarResize}
          onPointerCancel={stopSidebarResize}
          className={`group relative hidden w-3 shrink-0 cursor-col-resize touch-none items-center justify-center border-r border-gray-200 bg-white transition-colors hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 dark:border-white/10 dark:bg-[#101816] dark:hover:bg-accent-300/10 lg:flex ${
            isResizingSidebar ? "bg-accent-50 dark:bg-accent-300/10" : ""
          }`}
        >
          <span className="flex h-14 w-5 items-center justify-center rounded-full text-gray-300 transition-colors group-hover:text-accent-700 dark:text-sand-300/35 dark:group-hover:text-accent-100">
            <GripVertical className="h-4 w-4" />
          </span>
        </button>

        {/* ── Área del visor ── */}
        <main
          className="relative flex min-w-0 flex-1 flex-col items-center overflow-auto bg-stone-200 px-3 py-4 dark:bg-[#17231f] sm:px-5 sm:py-6 lg:px-8 lg:py-8"
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Toolbar flotante */}
          <div className="sticky top-0 z-20 mb-4 flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-white/85 px-2.5 py-2 shadow-[0_2px_20px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] backdrop-blur-md dark:border dark:border-white/10 dark:bg-[#101816]/90 sm:mb-6 sm:px-3">
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

            <div className="mx-1 hidden h-5 w-px bg-gray-200 sm:block dark:bg-white/10" />

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

            <div className="mx-1 hidden h-5 w-px bg-gray-200 sm:block dark:bg-white/10" />

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

        {/* ── Acción secundaria: consultas ── */}
        <button
          type="button"
          onClick={() => setToolsPanel("consultas")}
          className={`fixed bottom-20 right-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold shadow-lg backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/35 sm:bottom-6 sm:right-[10.75rem] ${
            toolsPanel === "consultas"
              ? "border-accent-300 bg-accent-600 text-white dark:bg-accent-300 dark:text-[#071713]"
              : "border-white/15 bg-[#071713]/80 text-sand-50 hover:bg-[#0d261f] dark:bg-[#071713]/85"
          }`}
        >
          <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Consultas</span>
        </button>

        {toolsPanel && (
          <>
            <button
              type="button"
              aria-label="Cerrar panel de herramientas"
              onClick={closeToolsPanel}
              className="fixed inset-0 top-14 z-40 bg-[#06110e]/35 backdrop-blur-[1px]"
            />
            <aside className="fixed bottom-0 right-0 top-14 z-50 flex w-[min(92vw,30rem)] flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#101816]">
              <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Consultas del apunte</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {resume.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeToolsPanel}
                  aria-label="Cerrar panel"
                  className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground dark:hover:bg-white/[0.06]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <MaterialQuestionsPanel
                  targetType="resume"
                  resumeId={resumeId}
                  currentPage={currentPage}
                  surface="embedded"
                />
              </div>
            </aside>
          </>
        )}
      </div>

      <AiChatPanel
        resumeId={resumeId}
        resumeTitle={resume.title}
        resumeSubject={resume.subject}
        resumeTopics={resume.topics}
        aiReady={aiReady}
      />
    </div>
  );
}

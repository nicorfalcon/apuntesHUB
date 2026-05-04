"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Resume } from "@/lib/database.types";
import { ResumeActionsMenu } from "./resume-actions-menu";

type Filter = "all" | "published" | "draft" | "archived";

interface ResumesListProps {
  resumes: Resume[];
  ventasPorResume: Record<string, number>;
  ingresosPorResume: Record<string, number>;
}

const STATUS_LABELS: Record<Resume["status"], { label: string; class: string }> = {
  published: { label: "Publicado", class: "bg-green-100 text-green-700" },
  draft: { label: "Borrador", class: "bg-gray-100 text-gray-600" },
  archived: { label: "Archivado", class: "bg-yellow-100 text-yellow-700" },
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "published", label: "Publicados" },
  { id: "draft", label: "Borradores" },
  { id: "archived", label: "Archivados" },
];

export function ResumesList({ resumes, ventasPorResume, ingresosPorResume }: ResumesListProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: resumes.length,
      published: resumes.filter((r) => r.status === "published").length,
      draft: resumes.filter((r) => r.status === "draft").length,
      archived: resumes.filter((r) => r.status === "archived").length,
    }),
    [resumes]
  );

  const visible = useMemo(
    () => (filter === "all" ? resumes : resumes.filter((r) => r.status === filter)),
    [resumes, filter]
  );

  if (resumes.length === 0) {
    return (
      <div className="text-center">
        <p className="text-gray-400">Todavía no publicaste ningún apunte.</p>
        <Link
          href="/sell/new?type=apunte"
          className="mt-4 inline-block rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
        >
          Publicar mi primer apunte
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent-50 text-accent-700 dark:bg-accent-300 dark:text-[#071713]"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-sand-300/75 dark:hover:bg-white/5 dark:hover:text-sand-50"
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                  active
                    ? "bg-white text-accent-700 dark:bg-[#071713] dark:text-accent-100"
                    : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-sand-200"
                }`}
              >
                {counts[f.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">
          No hay apuntes en este estado.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((resume) => {
            const statusInfo = STATUS_LABELS[resume.status];
            const ventas = ventasPorResume[resume.id] ?? 0;
            const ingresos = ingresosPorResume[resume.id] ?? 0;
            const hasRating = (resume.rating_count ?? 0) > 0;

            return (
              <div
                key={resume.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4"
              >
                {/* Miniatura */}
                <Link
                  href={`/resume/${resume.id}`}
                  className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md bg-accent-50 ring-1 ring-gray-200"
                  aria-label={`Ver ${resume.title}`}
                >
                  {resume.preview_url ? (
                    <Image
                      src={resume.preview_url}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-base font-semibold text-accent-700/70">
                      {resume.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.class}`}>
                      {statusInfo.label}
                    </span>
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {resume.title}
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {resume.subject} · {resume.university} · {ventas} venta{ventas !== 1 ? "s" : ""}
                    {ingresos > 0 && (
                      <> · ${ingresos.toLocaleString("es-AR")}</>
                    )}
                    {hasRating && (
                      <> · ★ {Number(resume.rating_avg).toFixed(1)} ({resume.rating_count})</>
                    )}
                  </p>
                </div>

                <div className="ml-4 flex shrink-0 items-center gap-2">
                  <span className="text-sm font-bold text-accent-700">
                    ${Number(resume.price).toLocaleString("es-AR")}
                  </span>
                  <ResumeActionsMenu resumeId={resume.id} resumeTitle={resume.title} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

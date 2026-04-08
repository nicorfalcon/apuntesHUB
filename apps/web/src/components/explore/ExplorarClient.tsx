"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from "lucide-react";
import type { ResumeWithSeller } from "@/lib/database.types";

interface ExplorarClientProps {
  resumes: ResumeWithSeller[];
  purchasedIds: string[];
}

export default function ExplorarClient({
  resumes,
  purchasedIds,
}: ExplorarClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUniversities, setSelectedUniversities] = useState<Set<string>>(
    new Set()
  );
  const [selectedCareers, setSelectedCareers] = useState<Set<string>>(
    new Set()
  );
  const [universitySearch, setUniversitySearch] = useState("");
  const [universityOpen, setUniversityOpen] = useState(true);
  const [careerOpen, setCareerOpen] = useState(true);

  const purchasedSet = useMemo(() => new Set(purchasedIds), [purchasedIds]);

  const universityCounts = useMemo(() => {
    const map = new Map<string, number>();
    resumes.forEach((r) => {
      map.set(r.university, (map.get(r.university) ?? 0) + 1);
    });
    return map;
  }, [resumes]);

  const careerCounts = useMemo(() => {
    const map = new Map<string, number>();
    resumes.forEach((r) => {
      map.set(r.career, (map.get(r.career) ?? 0) + 1);
    });
    return map;
  }, [resumes]);

  const filteredUniversities = useMemo(
    () =>
      Array.from(universityCounts.entries()).filter(([u]) =>
        u.toLowerCase().includes(universitySearch.toLowerCase())
      ),
    [universityCounts, universitySearch]
  );

  const filteredResumes = useMemo(() => {
    return resumes.filter((r) => {
      if (
        selectedUniversities.size > 0 &&
        !selectedUniversities.has(r.university)
      )
        return false;
      if (selectedCareers.size > 0 && !selectedCareers.has(r.career))
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !r.title.toLowerCase().includes(q) &&
          !r.subject.toLowerCase().includes(q) &&
          !r.university.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [resumes, selectedUniversities, selectedCareers, searchQuery]);

  type TagType = "university" | "career";
  const activeTags: { label: string; type: TagType }[] = [
    ...Array.from(selectedUniversities).map((u) => ({
      label: u,
      type: "university" as TagType,
    })),
    ...Array.from(selectedCareers).map((c) => ({
      label: c,
      type: "career" as TagType,
    })),
  ];

  const clearAll = () => {
    setSelectedUniversities(new Set());
    setSelectedCareers(new Set());
    setSearchQuery("");
    setUniversitySearch("");
  };

  const removeTag = (tag: { label: string; type: TagType }) => {
    if (tag.type === "university") {
      setSelectedUniversities((prev) => {
        const next = new Set(prev);
        next.delete(tag.label);
        return next;
      });
    } else {
      setSelectedCareers((prev) => {
        const next = new Set(prev);
        next.delete(tag.label);
        return next;
      });
    }
  };

  const toggleUniversity = (u: string) => {
    setSelectedUniversities((prev) => {
      const next = new Set(prev);
      if (next.has(u)) {
        next.delete(u);
      } else {
        next.add(u);
      }
      return next;
    });
  };

  const toggleCareer = (c: string) => {
    setSelectedCareers((prev) => {
      const next = new Set(prev);
      if (next.has(c)) {
        next.delete(c);
      } else {
        next.add(c);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Explorar apuntes</h1>
          <p className="mt-1 text-gray-500">
            Encontrá el material que necesitás para tu próximo examen.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-8">
          {/* ── Sidebar ── */}
          <aside className="w-[280px] shrink-0">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold text-gray-900">Filtros</span>
              {activeTags.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Limpiar todo
                </button>
              )}
            </div>

            {/* Active tags */}
            {activeTags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {activeTags.map((tag) => (
                  <span
                    key={`${tag.type}-${tag.label}`}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700"
                  >
                    {tag.label}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 hover:text-gray-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <hr className="mb-4 border-gray-200" />

            {/* Universidad */}
            <div className="mb-4">
              <button
                onClick={() => setUniversityOpen((v) => !v)}
                className="flex w-full items-center justify-between py-1 text-sm font-medium text-gray-900"
              >
                Universidad
                {universityOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {universityOpen && (
                <div className="mt-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={universitySearch}
                      onChange={(e) => setUniversitySearch(e.target.value)}
                      placeholder="Buscar universidad..."
                      className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-gray-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    {filteredUniversities.map(([u, count]) => (
                      <label
                        key={u}
                        className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUniversities.has(u)}
                          onChange={() => toggleUniversity(u)}
                          className="h-4 w-4 rounded border-gray-300 accent-[#1a4731]"
                        />
                        <span className="flex-1">{u}</span>
                        <span className="text-gray-400">({count})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <hr className="mb-4 border-gray-200" />

            {/* Carrera */}
            <div className="mb-4">
              <button
                onClick={() => setCareerOpen((v) => !v)}
                className="flex w-full items-center justify-between py-1 text-sm font-medium text-gray-900"
              >
                Carrera
                {careerOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {careerOpen && (
                <div className="mt-2 space-y-1.5">
                  {Array.from(careerCounts.entries()).map(([c, count]) => (
                    <label
                      key={c}
                      className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCareers.has(c)}
                        onChange={() => toggleCareer(c)}
                        className="h-4 w-4 rounded border-gray-300 accent-[#1a4731]"
                      />
                      <span className="flex-1">{c}</span>
                      <span className="text-gray-400">({count})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* ── Main content ── */}
          <div className="min-w-0 flex-1">
            {/* Search bar */}
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar apuntes por tema o autor..."
                  className="w-full rounded-full border border-gray-200 py-2.5 pl-11 pr-4 text-sm outline-none focus:border-gray-300"
                />
              </div>
              <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a4731] text-white hover:bg-[#153d29]">
                <Search className="h-4 w-4" />
              </button>
            </div>

            {/* Count */}
            <p className="mb-5 text-sm text-gray-500">
              Mostrando{" "}
              <span className="font-bold text-gray-900">
                {filteredResumes.length}
              </span>{" "}
              de {resumes.length} apuntes
            </p>

            {/* Grid */}
            {filteredResumes.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <p className="text-lg">No se encontraron apuntes.</p>
                <p className="mt-1 text-sm">Intentá con otros filtros.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-5">
                {filteredResumes.map((resume) => (
                  <ResumeCard
                    key={resume.id}
                    resume={resume}
                    purchased={purchasedSet.has(resume.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card component ────────────────────────────────────────────────────────────

function ResumeCard({
  resume,
  purchased,
}: {
  resume: ResumeWithSeller;
  purchased: boolean;
}) {
  const seller = resume.profiles;
  const [imageHovered, setImageHovered] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Image */}
      <div
        className="relative h-44"
        onMouseEnter={() => setImageHovered(true)}
        onMouseLeave={() => setImageHovered(false)}
      >
        {resume.preview_url ? (
          <Image
            src={resume.preview_url}
            alt={resume.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gray-100">
            <svg
              className="h-10 w-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
        )}

        {/* Purchased badge */}
        {purchased && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            <CheckCircle className="h-3 w-3" />
            Comprado
          </div>
        )}

        {/* Hover overlay */}
        {imageHovered && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Link
              href={`/resume/${resume.id}`}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
            >
              <Eye className="h-4 w-4" />
              Ver preview
            </Link>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span>{resume.university}</span>
          <span>·</span>
          <span>{resume.subject}</span>
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-base font-bold text-gray-900">
          {resume.title}
        </h3>
        <p className="mt-0.5 text-sm text-gray-500">by {seller.display_name}</p>

        <div className="mt-2 flex items-center gap-1.5">
          <StarRow rating={seller.seller_rating_avg ?? 0} />
          <span className="text-sm text-gray-500">
            ({seller.seller_rating_count ?? 0})
          </span>
        </div>

        <p className="mt-2 text-xl font-bold text-gray-900">
          ${resume.price.toLocaleString("es-AR")} ARS
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <Link
          href={`/resume/${resume.id}`}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Eye className="h-4 w-4" />
          Ver preview
        </Link>
      </div>
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i <= filled ? "text-yellow-400" : "text-gray-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}
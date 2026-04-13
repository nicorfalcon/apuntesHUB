"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import { ResumeCard } from "@/components/resume/resume-card";
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
  const [selectedUniversities, setSelectedUniversities] = useState<Set<string>>(new Set());
  const [selectedCareers, setSelectedCareers] = useState<Set<string>>(new Set());
  const [universitySearch, setUniversitySearch] = useState("");
  const [universityOpen, setUniversityOpen] = useState(true);
  const [careerOpen, setCareerOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const purchasedSet = useMemo(() => new Set(purchasedIds), [purchasedIds]);

  const universityCounts = useMemo(() => {
    const map = new Map<string, number>();
    resumes.forEach((r) => map.set(r.university, (map.get(r.university) ?? 0) + 1));
    return map;
  }, [resumes]);

  const careerCounts = useMemo(() => {
    const map = new Map<string, number>();
    resumes.forEach((r) => map.set(r.career, (map.get(r.career) ?? 0) + 1));
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
      if (selectedUniversities.size > 0 && !selectedUniversities.has(r.university)) return false;
      if (selectedCareers.size > 0 && !selectedCareers.has(r.career)) return false;
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
    ...Array.from(selectedUniversities).map((u) => ({ label: u, type: "university" as TagType })),
    ...Array.from(selectedCareers).map((c) => ({ label: c, type: "career" as TagType })),
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
      if (next.has(u)) next.delete(u);
      else next.add(u);
      return next;
    });
  };

  const toggleCareer = (c: string) => {
    setSelectedCareers((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const filterPanel = (
    <div className="rounded-xl bg-gray-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Filtros</span>
        {activeTags.length > 0 && (
          <button onClick={clearAll} className="text-sm text-gray-500 hover:text-gray-700">
            Limpiar todo
          </button>
        )}
      </div>

      {activeTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {activeTags.map((tag) => (
            <span
              key={`${tag.type}-${tag.label}`}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700"
            >
              {tag.label}
              <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-gray-900">
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
          {universityOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
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
                <label key={u} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
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
          {careerOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </button>

        {careerOpen && (
          <div className="mt-2 space-y-1.5">
            {Array.from(careerCounts.entries()).map(([c, count]) => (
              <label key={c} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
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
    </div>
  );

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

        {/* Botón filtros mobile */}
        <div className="mb-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeTags.length > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent-600 text-xs font-semibold text-white">
                {activeTags.length}
              </span>
            )}
          </button>
        </div>

        {/* Drawer sidebar mobile */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-white p-5 shadow-xl lg:hidden">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-base font-semibold text-gray-900">Filtros</span>
                <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {filterPanel}
              <button
                onClick={() => setSidebarOpen(false)}
                className="mt-4 w-full rounded-lg bg-accent-600 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
              >
                Ver {filteredResumes.length} resultado{filteredResumes.length !== 1 ? "s" : ""}
              </button>
            </div>
          </>
        )}

        {/* Two-column layout */}
        <div className="flex gap-8">
          {/* Sidebar desktop */}
          <aside className="hidden w-[280px] shrink-0 lg:block">
            {filterPanel}
          </aside>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            {/* Search bar */}
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar apuntes por tema o autor..."
                  className="w-full rounded-full border border-gray-200 py-2.5 pl-11 pr-4 text-sm outline-none focus:border-gray-300"
                />
              </div>
            </div>

            {/* Count */}
            <p className="mb-5 text-sm text-gray-500">
              Mostrando{" "}
              <span className="font-bold text-gray-900">{filteredResumes.length}</span>{" "}
              de {resumes.length} apuntes
            </p>

            {/* Grid */}
            {filteredResumes.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <p className="text-lg">No se encontraron apuntes.</p>
                <p className="mt-1 text-sm">Intentá con otros filtros.</p>
                <Link
                  href="/browse"
                  onClick={clearAll}
                  className="mt-4 inline-block text-sm text-accent-600 hover:underline"
                >
                  Limpiar filtros
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

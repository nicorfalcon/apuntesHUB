import { createClient } from "@/lib/supabase/server";
import { ResumeCard } from "@/components/resume/resume-card";
import type { ResumeWithSeller } from "@/lib/database.types";

interface SearchParams {
  universidad?: string;
  carrera?: string;
  materia?: string;
  orden?: string;
}

export default async function ExplorarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Query base con join a profiles
  let query = supabase
    .from("resumes")
    .select("*, profiles!seller_id(display_name, avatar_url, seller_rating_avg, seller_rating_count)")
    .eq("status", "published");

  if (filters.universidad) query = query.ilike("university", `%${filters.universidad}%`);
  if (filters.carrera) query = query.ilike("career", `%${filters.carrera}%`);
  if (filters.materia) query = query.ilike("subject", `%${filters.materia}%`);

  switch (filters.orden) {
    case "precio_asc":
      query = query.order("price", { ascending: true });
      break;
    case "precio_desc":
      query = query.order("price", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data: resumes } = await query;

  // IDs de resúmenes ya comprados por el usuario actual
  let purchasedIds = new Set<string>();
  if (user) {
    const { data: purchases } = await supabase
      .from("purchases")
      .select("resume_id")
      .eq("buyer_id", user.id)
      .eq("status", "completed");
    purchasedIds = new Set((purchases as { resume_id: string }[] | null)?.map((p) => p.resume_id) ?? []);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Explorar apuntes
      </h1>
      <p className="mt-2 text-gray-500">
        Encontrá el material que necesitás para tu próximo examen.
      </p>

      {/* Filtros */}
      <form method="GET" className="mt-6 flex flex-wrap gap-3">
        <input
          name="universidad"
          defaultValue={filters.universidad}
          placeholder="Universidad"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
        />
        <input
          name="carrera"
          defaultValue={filters.carrera}
          placeholder="Carrera"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
        />
        <input
          name="materia"
          defaultValue={filters.materia}
          placeholder="Materia"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
        />
        <select
          name="orden"
          defaultValue={filters.orden}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
        >
          <option value="">Más recientes</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
        >
          Filtrar
        </button>
        {(filters.universidad || filters.carrera || filters.materia || filters.orden) && (
          <a
            href="/browse"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Limpiar
          </a>
        )}
      </form>

      {!resumes || resumes.length === 0 ? (
        <div className="mt-16 text-center text-gray-400">
          <p className="text-lg">No se encontraron apuntes.</p>
          <p className="mt-1 text-sm">Intentá con otros filtros.</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(resumes as ResumeWithSeller[]).map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              purchased={purchasedIds.has(resume.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

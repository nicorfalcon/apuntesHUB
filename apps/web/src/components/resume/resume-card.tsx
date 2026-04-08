import Link from "next/link";
import { StarRating } from "@/components/ui/star-rating";
import type { ResumeWithSeller } from "@/lib/database.types";

interface ResumeCardProps {
  resume: ResumeWithSeller;
  purchased?: boolean;
}

export function ResumeCard({ resume, purchased = false }: ResumeCardProps) {
  const { profiles: seller } = resume;

  return (
    <Link
      href={`/resume/${resume.id}`}
      className="group relative rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
    >
      {purchased && (
        <span className="absolute right-3 top-3 rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700">
          Comprado
        </span>
      )}

      {resume.preview_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resume.preview_url}
          alt={resume.title}
          className="mb-4 h-32 w-full rounded-lg object-cover"
        />
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>{resume.university}</span>
        <span>·</span>
        <span>{resume.subject}</span>
      </div>

      <h3 className="mt-2 text-base font-semibold text-foreground group-hover:text-accent-600 line-clamp-2">
        {resume.title}
      </h3>

      <p className="mt-1 text-sm text-gray-500 truncate">por {seller.display_name}</p>

      <div className="mt-4 flex items-center justify-between">
        <StarRating
          rating={seller.seller_rating_avg ?? 0}
          count={seller.seller_rating_count ?? 0}
        />
        <span className="text-sm font-bold text-accent-700">
          ${resume.price.toLocaleString("es-AR")} ARS
        </span>
      </div>
    </Link>
  );
}

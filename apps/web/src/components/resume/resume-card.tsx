"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { StarRating } from "@/components/ui/star-rating";
import { ResumeTopicChips } from "./resume-topics";
import type { ResumeWithSeller } from "@/lib/database.types";
import {
  discountedPrice,
  formatDiscountBadge,
  hasDiscount,
} from "@/lib/discounts/direct";

interface ResumeCardProps {
  resume: ResumeWithSeller;
  purchased?: boolean;
}

export function ResumeCard({ resume, purchased = false }: ResumeCardProps) {
  const { profiles: seller } = resume;
  const discounted = hasDiscount(resume.discount_percent);
  const finalPrice = discountedPrice(resume.price, resume.discount_percent);

  return (
    <Link
      href={`/resume/${resume.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent-600 focus:ring-offset-2 dark:border-white/10 dark:bg-[#0f1e1a]"
    >
      {/* Image — backdrop sólido para que las previews con transparencia no
          se vean rotas (cuadrícula) sobre el fondo oscuro. */}
      <div className="relative h-44 bg-gray-100 dark:bg-white/[0.04]">
        {resume.preview_url ? (
          <Image
            src={resume.preview_url}
            alt={resume.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          // Placeholder editorial: monograma de la materia sobre un lavado de
          // acento, en vez de un ícono genérico de archivo. (La materia ya se
          // muestra en la fila de metadata debajo, así que acá no la repetimos.)
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-accent-50 to-gray-100 dark:from-accent-300/[0.08] dark:to-white/[0.02]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-2xl font-bold text-accent-700 shadow-sm ring-1 ring-accent-100 dark:bg-white/5 dark:text-accent-200 dark:ring-white/10">
              {(resume.subject || resume.title || "A").charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {purchased && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            <CheckCircle className="h-3 w-3" />
            Comprado
          </div>
        )}

        {discounted && !purchased && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm shadow-rose-900/30">
            {formatDiscountBadge(resume.discount_percent)}
          </div>
        )}
      </div>

      {/* Body — columna flex para empujar el precio al fondo y que todas las
          cards de una fila alineen el precio en la misma línea base. */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-sand-300/60">
          <span>{resume.university}</span>
          <span>·</span>
          <span>{resume.subject}</span>
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-base font-bold text-foreground">
          {resume.title}
        </h3>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-sand-300/75">
          por {seller.display_name}
        </p>

        <ResumeTopicChips
          topics={resume.topics}
          maxVisible={3}
          className="mt-2"
          chipClassName="max-w-[8.5rem] bg-gray-50 text-gray-600 ring-gray-200 dark:bg-white/[0.06] dark:text-sand-300 dark:ring-white/10"
        />

        <div className="mt-2">
          <StarRating
            rating={resume.rating_avg ?? 0}
            count={resume.rating_count ?? 0}
          />
        </div>

        {discounted ? (
          <div className="mt-auto flex items-baseline gap-2 pt-3">
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
              ${finalPrice.toLocaleString("es-AR")}{" "}
              <span className="text-xs font-semibold text-gray-400">ARS</span>
            </p>
            <p className="text-sm font-medium text-gray-400 line-through">
              ${resume.price.toLocaleString("es-AR")}
            </p>
          </div>
        ) : (
          <p className="mt-auto pt-3 text-xl font-bold text-foreground">
            ${resume.price.toLocaleString("es-AR")} ARS
          </p>
        )}
      </div>
    </Link>
  );
}

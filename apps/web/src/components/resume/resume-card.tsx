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
      className="group block overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent-600 focus:ring-offset-2"
    >
      {/* Image */}
      <div className="relative h-44">
        {resume.preview_url ? (
          <Image
            src={resume.preview_url}
            alt={resume.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
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
        <p className="mt-0.5 text-sm text-gray-500">por {seller.display_name}</p>

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
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-xl font-bold text-rose-600">
              ${finalPrice.toLocaleString("es-AR")}{" "}
              <span className="text-xs font-semibold text-gray-400">ARS</span>
            </p>
            <p className="text-sm font-medium text-gray-400 line-through">
              ${resume.price.toLocaleString("es-AR")}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xl font-bold text-gray-900">
            ${resume.price.toLocaleString("es-AR")} ARS
          </p>
        )}
      </div>
    </Link>
  );
}

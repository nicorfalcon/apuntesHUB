"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, CheckCircle } from "lucide-react";
import { StarRating } from "@/components/ui/star-rating";
import type { ResumeWithSeller } from "@/lib/database.types";

interface ResumeCardProps {
  resume: ResumeWithSeller;
  purchased?: boolean;
}

export function ResumeCard({ resume, purchased = false }: ResumeCardProps) {
  const { profiles: seller } = resume;
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

        {purchased && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            <CheckCircle className="h-3 w-3" />
            Comprado
          </div>
        )}

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
        <p className="mt-0.5 text-sm text-gray-500">por {seller.display_name}</p>

        <div className="mt-2">
          <StarRating
            rating={resume.rating_avg ?? 0}
            count={resume.rating_count ?? 0}
          />
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

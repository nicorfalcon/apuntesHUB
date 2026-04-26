"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PurchaseActionsMenu } from "./purchase-actions-menu";
import type { PurchaseWithResume, FolderWithItems } from "@/lib/database.types";

function BookOpenIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

interface PurchaseCardProps {
  purchase: PurchaseWithResume;
  folders: FolderWithItems[];
}

export function PurchaseCard({ purchase, folders }: PurchaseCardProps) {
  const resume = purchase.resumes;
  const existingReview = purchase.reviews ? { id: purchase.reviews.id } : undefined;
  const router = useRouter();
  const viewHref = `/my-purchases/${purchase.resume_id}/view`;

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => router.push(viewHref)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(viewHref);
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent-600 focus:ring-offset-2"
    >
      {/* Imagen / placeholder */}
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-gray-50">
        {resume?.preview_url ? (
          <Image
            src={resume.preview_url}
            alt={resume.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <DocumentIcon />
          </div>
        )}
        {/* Badge comprado */}
        <div className="absolute left-3 top-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
            <CheckIcon />
            Comprado
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
            {resume?.title ?? "Sin título"}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            por {resume?.profiles?.display_name ?? "—"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {resume?.subject && (
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{resume.subject}</span>
            )}
            {resume?.university && (
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{resume.university}</span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
          <span>
            {new Date(purchase.created_at).toLocaleDateString("es-AR", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </span>
          <span className="font-semibold text-foreground">
            ${Number(purchase.amount).toLocaleString("es-AR")} ARS
          </span>
        </div>

        {/* Acciones */}
        <div className="mt-3 flex items-center gap-2">
          <Link
            href={viewHref}
            onClick={(event) => event.stopPropagation()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-700"
          >
            <BookOpenIcon />
            Ver apunte
          </Link>

          <PurchaseActionsMenu
            purchaseId={purchase.id}
            resumeId={purchase.resume_id}
            sellerId={purchase.seller_id}
            folders={folders}
            existingReview={existingReview}
          />
        </div>
      </div>
    </article>
  );
}

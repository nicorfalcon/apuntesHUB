import { redirect } from "next/navigation";

export default async function BrowseRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ career?: string }>;
}) {
  const { career } = await searchParams;
  const params = new URLSearchParams();
  if (career) params.set("career", career);

  redirect(`/explorar${params.toString() ? `?${params.toString()}` : ""}`);
}

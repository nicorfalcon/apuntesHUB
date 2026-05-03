import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

export async function createRouteClient() {
  const cookieStore = await cookies();
  const cookiesToSet: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(nextCookies) {
          cookiesToSet.push(
            ...nextCookies.map(({ name, value, options }) => ({
              name,
              value,
              options: options as Record<string, unknown>,
            }))
          );
        },
      },
    }
  );

  return { supabase, cookiesToSet };
}

export function applyRouteCookies(
  response: NextResponse,
  cookiesToSet: CookieToSet[]
) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set({
      name,
      value,
      ...options,
    });
  });
}

export type { CookieToSet };

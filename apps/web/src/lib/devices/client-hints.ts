/**
 * Client-side brand detection. Used to disambiguate browsers that hide
 * themselves behind another's User-Agent (notably Brave, which masquerades
 * as Chrome). Returns null when the browser cannot be confidently identified.
 */
export async function getClientBrand(): Promise<"brave" | null> {
  if (typeof navigator === "undefined") return null;
  try {
    const nav = navigator as Navigator & {
      brave?: { isBrave?: () => Promise<boolean> };
    };
    if (nav.brave?.isBrave && (await nav.brave.isBrave())) {
      return "brave";
    }
  } catch {
    // Ignore: API not available or threw.
  }
  return null;
}

export const CLIENT_BRAND_HEADER = "x-client-brand";

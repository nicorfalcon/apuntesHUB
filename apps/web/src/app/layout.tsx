import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { ThemeRouteGuard } from "@/components/theme/theme-route-guard";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "apuntesHUB — Comprá y vendé apuntes universitarios",
  description:
    "Marketplace de apuntes universitarios. Comprá y vendé resúmenes, guías y material de estudio con calidad garantizada.",
};

const themeScript = `
  try {
    const publicLightPaths = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
    const isPublicLightPath = publicLightPaths.includes(window.location.pathname);
    const theme = isPublicLightPath ? "light" : localStorage.getItem("apunteshub-theme");
    const prefersDark = !isPublicLightPath && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme = theme === "dark" || (!theme && prefersDark) ? "dark" : "light";
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  } catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${instrumentSerif.variable} font-body antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeRouteGuard />
        <NavbarWrapper />
        <main>{children}</main>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
//cambios

import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${instrumentSerif.variable} font-body antialiased`}>
        <NavbarWrapper />
        <main>{children}</main>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}

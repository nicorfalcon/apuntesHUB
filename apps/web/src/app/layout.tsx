import type { Metadata } from "next";
import localFont from "next/font/local";
import { Sora, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
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
      <body className={`${geistSans.variable} ${sora.variable} ${instrumentSerif.variable} font-body antialiased`}>
        <NavbarWrapper />
        <main>{children}</main>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}

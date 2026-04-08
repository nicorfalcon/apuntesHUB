import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
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
      <body className={`${geistSans.variable} font-body antialiased`}>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}

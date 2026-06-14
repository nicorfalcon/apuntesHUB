"use client";

import Link from "next/link";
import { Marquee } from "@/components/landing/marquee";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#001d2b] text-white">
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />

      {/* Navbar landing */}
      <nav className="relative z-10 w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8 md:py-6">
          <Link
            href="/"
            className="text-2xl font-extrabold tracking-tight text-white md:text-3xl"
          >
            apuntes<span className="text-[#87b5a8]">HUB</span><span className="text-[#87b5a8]">.</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#como-funciona" className="landing-hover-green rounded-full px-2 py-1 text-sm font-medium tracking-wide text-white/60 transition-all hover:text-[#d9e8e4]">
              Como funciona
            </a>
            <a href="#explorar" className="landing-hover-green rounded-full px-2 py-1 text-sm font-medium tracking-wide text-white/60 transition-all hover:text-[#d9e8e4]">
              Explorar
            </a>
            <a href="#vendedores" className="landing-hover-green rounded-full px-2 py-1 text-sm font-medium tracking-wide text-white/60 transition-all hover:text-[#d9e8e4]">
              Vende tus apuntes
            </a>
            <a href="#estudiar-ia" className="landing-hover-green rounded-full px-2 py-1 text-sm font-medium tracking-wide text-white/60 transition-all hover:text-[#d9e8e4]">
              Estudiá con IA
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="landing-hover-green hidden rounded-full px-2 py-1 text-sm font-medium text-white transition-all hover:text-[#d9e8e4] md:inline-flex"
            >
              Ingresar
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-[#3b6558] px-6 py-2.5 text-sm font-medium text-white shadow-[0_10px_28px_rgba(59,101,88,0.28)] transition-all hover:scale-[1.04] hover:bg-[#4a7e6d]"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 flex min-h-[calc(100svh-148px)] flex-col items-center justify-center px-4 pb-8 pt-10 text-center md:min-h-[calc(100svh-156px)] md:px-8 md:pb-10 md:pt-12">
        <p className="animate-fade-rise text-xs font-medium uppercase tracking-[0.25em] text-[#a7c1b6]">
          La plataforma de apuntes universitarios
        </p>

        <h1
          className="animate-fade-rise-delay mt-5 max-w-6xl text-4xl font-extrabold leading-[0.96] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5.8rem]"
        >
          Donde tus <em className="not-italic text-[#a7c1b6]">apuntes</em>{" "}
          encuentran <em className="not-italic text-[#a7c1b6]">su lugar.</em>
        </h1>

        <p className="animate-fade-rise-delay-2 mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
          Compartí, descubrí y vendé los mejores apuntes de tu carrera.
          Organizado por universidad, materia y profesor.
        </p>

      </div>

      <Marquee />
      <div
        className="relative z-10 -mt-12 h-24 bg-gradient-to-b from-transparent via-sand-100/70 to-sand-100"
        aria-hidden="true"
      />
    </section>
  );
}

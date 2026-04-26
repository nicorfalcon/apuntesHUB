"use client";

import Link from "next/link";

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";

export function HeroSection() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ── Video background ───────────��──────────────────────── */}
      <video
        className="absolute inset-0 h-full w-full object-cover z-0"
        style={{ willChange: "transform" }}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
      >
        <source src={VIDEO_SRC} type="video/mp4" media="(max-width: 768px)" />
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>

      {/* ── Dark overlay — cinematic, no wash ─────────────────── */}
      <div className="absolute inset-0 z-[1] bg-black/70" />

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="relative z-10 flex min-h-screen flex-col">

        {/* ── Navigation ────────────────────��───────────────────── */}
        <nav className="px-4 py-5 md:px-8">
          <div className="mx-auto flex max-w-7xl flex-row items-center justify-between">

            {/* Logo — identical to /browse navbar */}
            <Link href="/" className="text-xl font-bold tracking-tight text-white">
              apuntes<span className="text-accent-400">HUB</span>
            </Link>

            {/* CTAs — no middle links */}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden rounded-full px-5 py-2 text-sm font-medium text-accent-300 transition-all duration-200 hover:scale-[1.03] hover:bg-white/10 md:inline-flex"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.03] hover:bg-accent-500"
              >
                Registrarse
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero content ──────────────────────────────────────── */}
        <section className="flex flex-1 flex-col items-center justify-center px-4 pb-40 pt-16 text-center md:px-8 md:pt-20">
          <h1 className="animate-fade-rise max-w-5xl text-5xl font-bold leading-[0.95] tracking-[-2.46px] text-white sm:text-7xl md:text-8xl">
            Donde tus{" "}
            <span className="text-accent-400">apuntes</span>{" "}
            encuentran{" "}
            <span className="text-white/50">su lugar.</span>
          </h1>

          <p className="animate-fade-rise-delay mx-auto mt-8 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
            La plataforma colaborativa para estudiantes universitarios.
            Compartí, descubrí y organizá los mejores apuntes de tu carrera.
            Estudiar nunca fue tan claro.
          </p>

          <Link
            href="/register"
            className="animate-fade-rise-delay-2 mt-12 rounded-full bg-accent-600 px-14 py-5 text-base font-medium text-white transition-all duration-200 hover:scale-[1.03] hover:brightness-110"
          >
            Empezar ahora
          </Link>
        </section>
      </div>
    </div>
  );
}

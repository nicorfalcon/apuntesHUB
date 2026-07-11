"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPasswordStrength } from "@/lib/auth/password-strength";
import {
  validateRegisterStep,
  type RegisterStepErrors,
} from "@/lib/auth/register-validation";
import { useE2EHydrationReady } from "@/lib/e2e/use-e2e-hydration-ready";
import { AuthPanel } from "@/components/auth/auth-panel";

// ─── Types ───────────────────────────────────────────────────────────────────

type FormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  university: string;
  career: string;
};

type StepErrors = Partial<Record<keyof FormData, string>>;

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Datos personales" },
  { label: "Contraseña" },
  { label: "Universidad" },
];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300 ${
                  done
                    ? "border-[#2D6A4F] bg-[#2D6A4F] text-white"
                    : active
                    ? "border-[#2D6A4F] bg-[#2D6A4F] text-white"
                    : "border-[#d1d5db] bg-white text-[#9CA3AF]"
                }`}
              >
                {done ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`mt-1 text-[10px] font-medium whitespace-nowrap transition-colors duration-300 ${
                  active ? "text-[#2D6A4F]" : done ? "text-[#2D6A4F]" : "text-[#9CA3AF]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div
                className={`mb-4 h-0.5 w-12 sm:w-16 transition-all duration-500 ${
                  i < current ? "bg-[#2D6A4F]" : "bg-[#d1d5db]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Eye icon ─────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

// ─── Input component ──────────────────────────────────────────────────────────

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[#1a1a1a]">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  `mt-1.5 w-full rounded-lg border px-4 py-2.5 text-sm text-[#1a1a1a] outline-none transition-colors focus:ring-2 ${
    hasError
      ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20"
      : "border-[#d1d5db] focus:border-[#2D6A4F] focus:ring-[#2D6A4F]/20"
  }`;

// ─── Main component ───────────────────────────────────────────────────────────

export default function RegisterPage() {
  useE2EHydrationReady();

  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    university: "",
    career: "",
  });

  const [errors, setErrors] = useState<StepErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function validateStep(s: number): RegisterStepErrors {
    return validateRegisterStep(s, form);
  }

  function navigate(nextStep: number) {
    setDirection(nextStep > step ? "forward" : "back");
    setAnimating(true);
    setTimeout(() => {
      setStep(nextStep);
      setAnimating(false);
    }, 200);
  }

  function handleNext() {
    const e = validateStep(step);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setErrors({});
    navigate(step + 1);
  }

  function handleBack() {
    setErrors({});
    navigate(step - 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const e2 = validateStep(2);
    if (Object.keys(e2).length > 0) {
      setErrors(e2);
      return;
    }

    setServerError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.name,
          university: form.university,
          career: form.career,
        },
      },
    });

    if (error) {
      setServerError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  const strength = getPasswordStrength(form.password);
  const passwordsMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const passwordsMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  // ── Success screen ──────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="flex min-h-screen">
        <div className="flex w-full flex-col items-center justify-center bg-white px-6 lg:w-1/2">
          <div className="w-full max-w-sm space-y-6 text-center">
            {/* Check icon */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#2D6A4F]/10">
              <svg className="h-10 w-10 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a1a]">¡Cuenta creada!</h2>
              <p className="mt-2 text-gray-500">
                Bienvenido/a a apuntesHUB,{" "}
                <span className="font-semibold text-[#2D6A4F]">{form.name.split(" ")[0]}</span>
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Revisá tu email para confirmar tu cuenta antes de iniciar sesión.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-block w-full rounded-lg bg-[#2D6A4F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#40916C]"
            >
              Comenzar
            </Link>
          </div>
        </div>

        {/* Right panel */}
        <AuthPanel image="/images/register-photo.jpg" />
      </div>
    );
  }

  // ── Step titles ─────────────────────────────────────────────────────────────

  const stepTitles = [
    { title: "Creá tu cuenta", subtitle: "Ingresá tus datos para empezar" },
    { title: "Elegí tu contraseña", subtitle: "Asegurá tu cuenta con una contraseña segura" },
    { title: "¿Dónde estudiás?", subtitle: "Así podemos mostrarte los apuntes más relevantes" },
  ];

  // ── Main layout ─────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen">
      {/* Left panel - Form */}
      <div className="relative flex w-full flex-col bg-white px-6 lg:w-1/2">
        {/* Logo */}
        <div className="flex shrink-0 items-center py-6 pl-2">
          <Link href="/" className="text-xl font-bold text-[#1a1a1a]">
            apuntes<span className="text-[#2D6A4F]">HUB</span>
          </Link>
        </div>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            {/* Stepper */}
            <Stepper current={step} />

            {/* Step content with fade transition */}
            <div
              className="transition-all duration-200"
              style={{
                opacity: animating ? 0 : 1,
                transform: animating
                  ? `translateX(${direction === "forward" ? "12px" : "-12px"})`
                  : "translateX(0)",
              }}
            >
              {/* Step heading */}
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-[#1a1a1a]">
                  {stepTitles[step].title}
                </h1>
                <p className="mt-1 text-sm text-gray-500">{stepTitles[step].subtitle}</p>
              </div>

              <form
                onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}
                className="space-y-4"
                noValidate
              >
                {/* ── Step 1: Personal data ─────────────────────────────── */}
                {step === 0 && (
                  <>
                    <Field id="name" label="Nombre completo" error={errors.name}>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        autoFocus
                        autoComplete="name"
                        placeholder="Juan Pérez"
                        value={form.name}
                        onChange={handleChange}
                        className={inputClass(!!errors.name)}
                      />
                    </Field>
                    <Field id="email" label="Email" error={errors.email}>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="juan@universidad.edu.ar"
                        value={form.email}
                        onChange={handleChange}
                        className={inputClass(!!errors.email)}
                      />
                    </Field>
                  </>
                )}

                {/* ── Step 2: Password ──────────────────────────────────── */}
                {step === 1 && (
                  <>
                    <Field id="password" label="Contraseña" error={errors.password}>
                      <div className="relative">
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoFocus
                          autoComplete="new-password"
                          placeholder="Mínimo 6 caracteres"
                          value={form.password}
                          onChange={handleChange}
                          className={inputClass(!!errors.password) + " pr-10"}
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F]/25"
                        >
                          <EyeIcon open={showPassword} />
                        </button>
                      </div>
                    </Field>

                    {/* Password strength bar */}
                    {form.password.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="h-1 flex-1 rounded-full transition-all duration-300"
                              style={{
                                backgroundColor: i <= strength.score ? strength.color : "#E5E7EB",
                              }}
                            />
                          ))}
                        </div>
                        <p className="text-right text-xs font-medium" style={{ color: strength.color }}>
                          {strength.label}
                        </p>
                      </div>
                    )}

                    <Field id="confirmPassword" label="Confirmar contraseña" error={errors.confirmPassword}>
                      <div className="relative">
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirm ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Repetí tu contraseña"
                          value={form.confirmPassword}
                          onChange={handleChange}
                          className={inputClass(!!errors.confirmPassword || passwordsMismatch) + " pr-10"}
                        />
                        <button
                          type="button"
                          aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                          onClick={() => setShowConfirm((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F]/25"
                        >
                          <EyeIcon open={showConfirm} />
                        </button>
                        {passwordsMatch && (
                          <div className="absolute right-9 top-1/2 -translate-y-1/2">
                            <svg className="h-4 w-4 text-[#2D6A4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {!errors.confirmPassword && passwordsMismatch && (
                        <p className="mt-1 text-xs text-[#DC2626]">Las contraseñas no coinciden</p>
                      )}
                    </Field>
                  </>
                )}

                {/* ── Step 3: University ────────────────────────────────── */}
                {step === 2 && (
                  <>
                    <Field id="university" label="Universidad" error={errors.university}>
                      <input
                        id="university"
                        name="university"
                        type="text"
                        autoFocus
                        placeholder="UBA, UTN, UNC..."
                        value={form.university}
                        onChange={handleChange}
                        className={inputClass(!!errors.university)}
                      />
                    </Field>
                    <Field id="career" label="Carrera" error={errors.career}>
                      <input
                        id="career"
                        name="career"
                        type="text"
                        placeholder="Ingeniería, Derecho, Medicina..."
                        value={form.career}
                        onChange={handleChange}
                        className={inputClass(!!errors.career)}
                      />
                    </Field>

                    {serverError && (
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[#DC2626]">
                        {serverError}
                      </p>
                    )}
                  </>
                )}

                {/* ── Navigation buttons ────────────────────────────────── */}
                <div className={`flex gap-3 pt-2 ${step > 0 ? "flex-row" : "flex-col"}`}>
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex-1 rounded-lg border border-[#d1d5db] px-4 py-2.5 text-sm font-semibold text-[#1a1a1a] transition-colors hover:bg-gray-50"
                    >
                      Volver
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-lg bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#40916C] disabled:opacity-60"
                  >
                    {step === 2
                      ? loading
                        ? "Creando cuenta..."
                        : "Crear cuenta"
                      : "Continuar"}
                  </button>
                </div>
              </form>
            </div>

            {/* Login link */}
            <p className="mt-6 text-center text-sm text-gray-500">
              ¿Ya tenés cuenta?{" "}
              <Link href="/login" className="font-medium text-[#2D6A4F] hover:text-[#40916C] hover:underline">
                Iniciá sesión
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right panel - Image */}
      <AuthPanel image="/images/register-photo.jpg" />
    </div>
  );
}

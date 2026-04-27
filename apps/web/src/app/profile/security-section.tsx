"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Monitor,
  Sparkles,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/utils/format-relative";
import { CLIENT_BRAND_HEADER, getClientBrand } from "@/lib/devices/client-hints";

interface Device {
  id: string;
  label: string | null;
  created_at: string;
  last_seen_at: string;
  is_current: boolean;
}

interface SecuritySectionProps {
  email: string;
  hasPassword: boolean;
}

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGIT = "23456789";
const SYMBOL = "!@#$%^&*-_=+?";

function pickRandom(set: string, bytes: Uint8Array, offset: number) {
  return set[bytes[offset] % set.length];
}

function generateSecurePassword(length = 16): string {
  const all = LOWER + UPPER + DIGIT + SYMBOL;
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  const chars: string[] = [
    pickRandom(LOWER, bytes, 0),
    pickRandom(UPPER, bytes, 1),
    pickRandom(DIGIT, bytes, 2),
    pickRandom(SYMBOL, bytes, 3),
  ];
  for (let i = 4; i < length; i++) {
    chars.push(all[bytes[i] % all.length]);
  }
  // Fisher-Yates shuffle using fresh randomness
  const shuffleBytes = new Uint8Array(length);
  crypto.getRandomValues(shuffleBytes);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  colorClass: string;
}

function evaluateStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "Ingresá una contraseña", colorClass: "bg-gray-200" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;

  const map: Record<number, Strength> = {
    0: { score: 0, label: "Muy débil", colorClass: "bg-red-400" },
    1: { score: 1, label: "Débil", colorClass: "bg-orange-400" },
    2: { score: 2, label: "Aceptable", colorClass: "bg-yellow-400" },
    3: { score: 3, label: "Fuerte", colorClass: "bg-accent-500" },
    4: { score: 4, label: "Muy fuerte", colorClass: "bg-accent-600" },
  };
  return map[score as 0 | 1 | 2 | 3 | 4];
}

export function SecuritySection({ email, hasPassword }: SecuritySectionProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [devices, setDevices] = useState<Device[] | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const strength = useMemo(() => evaluateStrength(newPassword), [newPassword]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // If this browser hides itself behind another's UA (Brave),
        // re-hit register with the brand hint to refresh the label.
        // Re-registering an existing device is idempotent.
        const brand = await getClientBrand();
        if (brand) {
          await fetch("/api/auth/devices/register", {
            method: "POST",
            headers: { [CLIENT_BRAND_HEADER]: brand },
          }).catch(() => {});
        }

        const res = await fetch("/api/auth/devices/list");
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as { devices: Device[] };
        if (!cancelled) setDevices(data.devices);
      } catch {
        if (!cancelled) setDevices([]);
      } finally {
        if (!cancelled) setDevicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRevokeDevice(device: Device) {
    if (device.is_current) return;
    if (!confirm(`¿Revocar "${device.label ?? "este dispositivo"}"?`)) return;
    setRevokingId(device.id);
    const res = await fetch("/api/auth/devices/revoke", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_row_id: device.id }),
    });
    if (!res.ok) {
      toast.error("No se pudo revocar el dispositivo.");
      setRevokingId(null);
      return;
    }
    setDevices((prev) => prev?.filter((d) => d.id !== device.id) ?? null);
    toast.success("Dispositivo revocado.");
    setRevokingId(null);
  }

  async function handleGenerate() {
    const pw = generateSecurePassword(16);
    setNewPassword(pw);
    setConfirmPassword(pw);
    setShowNew(true);
    try {
      await navigator.clipboard.writeText(pw);
      toast.success("Contraseña generada y copiada al portapapeles.");
    } catch {
      toast.success("Contraseña generada. Copiala antes de guardar.");
    }
    setJustGenerated(true);
    setTimeout(() => setJustGenerated(false), 2000);
  }

  async function handleCopy() {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      toast.success("Copiada al portapapeles.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (hasPassword && !currentPassword) {
      setError("Ingresá tu contraseña actual.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (hasPassword) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) {
        setError("La contraseña actual no es correcta.");
        setLoading(false);
        return;
      }
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      toast.error("No se pudo actualizar la contraseña.");
      setLoading(false);
      return;
    }

    toast.success(
      hasPassword ? "Contraseña actualizada." : "Contraseña establecida."
    );
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
    router.refresh();
  }

  async function handleSignOutEverywhere() {
    if (!confirm("¿Cerrar sesión en todos los dispositivos? Vas a tener que volver a iniciar sesión.")) return;
    setSigningOutAll(true);

    const res = await fetch("/api/auth/devices/revoke-all", { method: "POST" });
    if (!res.ok) {
      toast.error("No se pudo cerrar las sesiones.");
      setSigningOutAll(false);
      return;
    }

    // The current device's auth.sessions row was just deleted server-side.
    // Clear local cookies/tokens too so this tab stops thinking it's signed in.
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});

    toast.success("Sesiones cerradas. Vas a iniciar sesión nuevamente.");
    router.push("/login");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5 pr-10 text-sm text-gray-900 outline-none transition-all focus:border-accent-400 focus:ring-2 focus:ring-accent-200/40 placeholder:text-gray-400";
  const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

  return (
    <div className="space-y-8">
      {/* Card: Contraseña */}
      <section className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
            <KeyRound className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {hasPassword ? "Cambiar contraseña" : "Establecer contraseña"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasPassword
                ? "Actualizá tu contraseña periódicamente. Te recomendamos usar una combinación única que no uses en otros sitios."
                : "Tu cuenta se creó con Google. Si querés también poder ingresar con email y contraseña, establecé una acá."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {hasPassword && (
            <div>
              <label htmlFor="current-password" className={labelClass}>
                Contraseña actual
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  name="current-password"
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label={showCurrent ? "Ocultar" : "Mostrar"}
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="new-password" className={labelClass}>
                Nueva contraseña
              </label>
              <button
                type="button"
                onClick={handleGenerate}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-700 transition-colors hover:text-accent-800"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Sugerir segura
              </button>
            </div>
            <div className="relative">
              <input
                id="new-password"
                name="new-password"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="Mínimo 8 caracteres"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {newPassword && (
                  <button
                    type="button"
                    aria-label="Copiar"
                    onClick={handleCopy}
                    className="rounded p-1 text-gray-400 hover:text-gray-600"
                  >
                    {justGenerated ? <Check className="h-4 w-4 text-accent-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={showNew ? "Ocultar" : "Mostrar"}
                  onClick={() => setShowNew((v) => !v)}
                  className="rounded p-1 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Strength meter */}
            <div className="mt-2.5">
              <div className="flex h-1.5 gap-1">
                {[1, 2, 3, 4].map((seg) => (
                  <div
                    key={seg}
                    className={`h-full flex-1 rounded-full transition-colors ${
                      seg <= strength.score ? strength.colorClass : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-500">{strength.label}</p>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className={labelClass}>
              Confirmar nueva contraseña
            </label>
            <input
              id="confirm-password"
              name="confirm-password"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass.replace(" pr-10", "")}
              placeholder="Repetí la nueva contraseña"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end border-t border-gray-100 pt-5">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm transition-all disabled:opacity-60 hover:shadow-md"
              style={{ backgroundColor: "#1B5E45", color: "#E1F5EE" }}
            >
              {loading
                ? "Guardando..."
                : hasPassword
                ? "Actualizar contraseña"
                : "Establecer contraseña"}
            </button>
          </div>
        </form>
      </section>

      {/* Card: Dispositivos conectados */}
      <section className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
            <Monitor className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Dispositivos conectados
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Sólo se permiten 2 dispositivos activos por cuenta. Si querés usar uno nuevo,
              revocá alguno desde acá.
            </p>

            <div className="mt-5">
              {devicesLoading ? (
                <p className="text-sm text-gray-400">Cargando dispositivos...</p>
              ) : !devices || devices.length === 0 ? (
                <p className="text-sm text-gray-400">No hay dispositivos registrados.</p>
              ) : (
                <ul className="space-y-2">
                  {devices.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-gray-50/50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {d.label ?? "Dispositivo desconocido"}
                          </span>
                          {d.is_current && (
                            <span className="inline-flex rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-700 ring-1 ring-inset ring-accent-200/60">
                              Este dispositivo
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400">
                          Última conexión {formatRelative(d.last_seen_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeDevice(d)}
                        disabled={d.is_current || revokingId === d.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:text-gray-600"
                      >
                        <X className="h-3.5 w-3.5" />
                        {revokingId === d.id ? "Revocando..." : "Revocar"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-gray-400">
                Al revocar un dispositivo, su sesión se invalida y va a quedar deslogueado en su próxima navegación.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Card: Sesiones */}
      <section className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
            <LogOut className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Sesiones activas
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Si perdiste un dispositivo o sospechás que alguien accedió a tu cuenta, cerrá sesión en
              todos lados. Vas a tener que volver a iniciar sesión en este navegador también.
            </p>
            <button
              type="button"
              onClick={handleSignOutEverywhere}
              disabled={signingOutAll}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {signingOutAll ? "Cerrando sesiones..." : "Cerrar sesión en todos los dispositivos"}
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}

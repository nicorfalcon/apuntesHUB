"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CalendarOff,
  Plus,
  Trash2,
  Clock,
  CalendarDays,
  CalendarRange,
  Loader2,
  Info,
} from "lucide-react";

type BlockType = "custom" | "day" | "week";

type BlockedSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  block_type: BlockType;
  reason: string | null;
  created_at: string;
};

export function BlockedSlotsManager() {
  const [blocks, setBlocks] = useState<BlockedSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [type, setType] = useState<BlockType>("custom");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");

  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });

  useEffect(() => {
    fetchBlocks();
  }, []);

  async function fetchBlocks() {
    try {
      const res = await fetch("/api/tutors/block-slots");
      if (!res.ok) throw new Error("Error al cargar bloqueos");
      const data = await res.json();
      setBlocks(data.blocks || []);
    } catch (err) {
      toast.error("No se pudieron cargar los bloqueos");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!date) {
      toast.error("Seleccioná una fecha");
      return;
    }

    if (type === "custom") {
      if (!startTime || !endTime) {
        toast.error("Seleccioná la hora de inicio y fin");
        return;
      }
      if (startTime >= endTime) {
        toast.error("La hora de fin debe ser posterior al inicio");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tutors/block-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          date,
          start_time: type === "custom" ? startTime : undefined,
          end_time: type === "custom" ? endTime : undefined,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear bloqueo");

      toast.success("Horario bloqueado con éxito");
      
      // Reset form
      setDate("");
      setStartTime("");
      setEndTime("");
      setReason("");
      
      // Refresh list
      fetchBlocks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido al bloquear");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Estás seguro de eliminar este bloqueo?")) return;

    setDeletingId(id);
    try {
      const res = await fetch("/api/tutors/block-slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block_id: id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar");

      toast.success("Bloqueo eliminado");
      setBlocks((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar bloqueo");
    } finally {
      setDeletingId(null);
    }
  }

  function formatDateTime(isoString: string) {
    return new Date(isoString).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDateOnly(isoString: string) {
    return new Date(isoString).toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] sm:p-5">
      <div className="flex flex-col gap-1 border-b border-gray-100 pb-4 dark:border-white/5">
        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <CalendarOff className="h-5 w-5 text-accent-600 dark:text-accent-400" />
          Bloqueo de horarios
        </h3>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Gestioná excepciones de disponibilidad sin afectar clases ya reservadas.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Formulario de Creación */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-xl border border-accent-200 bg-accent-50/70 p-3 text-sm text-accent-900 dark:border-accent-300/20 dark:bg-accent-300/10 dark:text-accent-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="mb-0.5 font-semibold">Información importante</p>
              <p className="leading-5">Los bloqueos ocultan horarios libres para nuevas reservas, pero <strong>no cancelan</strong> clases confirmadas ni pendientes de pago.</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setType("custom")}
                className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:focus-visible:ring-accent-300 ${
                  type === "custom"
                    ? "bg-white text-foreground shadow-sm dark:bg-[#071713] dark:text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="h-3.5 w-3.5" /> Horario
              </button>
              <button
                type="button"
                onClick={() => setType("day")}
                className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:focus-visible:ring-accent-300 ${
                  type === "day"
                    ? "bg-white text-foreground shadow-sm dark:bg-[#071713] dark:text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Día
              </button>
              <button
                type="button"
                onClick={() => setType("week")}
                className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:focus-visible:ring-accent-300 ${
                  type === "week"
                    ? "bg-white text-foreground shadow-sm dark:bg-[#071713] dark:text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarRange className="h-3.5 w-3.5" /> Semana
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="blocked-slot-date" className="text-xs font-bold text-muted-foreground">
                  {type === "week" ? "Fecha de la semana a bloquear" : "Fecha"}
                </label>
                <input
                  id="blocked-slot-date"
                  type="date"
                  min={todayStr}
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-foreground focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-white/10 dark:bg-[#071713] dark:focus:border-accent-300 dark:focus:ring-accent-300"
                />
              </div>

              {type === "custom" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="blocked-slot-start" className="text-xs font-bold text-muted-foreground">Hora inicio</label>
                    <input
                      id="blocked-slot-start"
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-foreground focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-white/10 dark:bg-[#071713] dark:focus:border-accent-300 dark:focus:ring-accent-300"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="blocked-slot-end" className="text-xs font-bold text-muted-foreground">Hora fin</label>
                    <input
                      id="blocked-slot-end"
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-foreground focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-white/10 dark:bg-[#071713] dark:focus:border-accent-300 dark:focus:ring-accent-300"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="blocked-slot-reason" className="text-xs font-bold text-muted-foreground">Motivo (opcional)</label>
                <input
                  id="blocked-slot-reason"
                  type="text"
                  placeholder="Ej: turno médico, vacaciones"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-foreground placeholder-gray-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-white/10 dark:bg-[#071713] dark:placeholder-gray-500 dark:focus:border-accent-300 dark:focus:ring-accent-300"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-accent-300 dark:text-[#071713] dark:hover:bg-accent-200 dark:focus-visible:ring-accent-300 dark:focus-visible:ring-offset-[#0f1e1a]"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Bloquear horario
            </button>
          </form>
        </div>

        {/* Listado de Bloqueos */}
        <div className="flex flex-col gap-3">
          <h4 className="border-b border-gray-100 pb-2 text-sm font-bold text-foreground dark:border-white/5">
            Bloqueos activos
          </h4>
          
          <div className="-mr-2 max-h-[350px] flex-1 space-y-3 overflow-y-auto pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 p-8 text-sm text-muted-foreground dark:border-white/10">
                <Loader2 className="h-6 w-6 animate-spin" />
                Cargando bloqueos...
              </div>
            ) : blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-white/10 dark:bg-white/[0.02]">
                <CalendarOff className="h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  No tenés horarios bloqueados
                </p>
                <p className="text-xs text-muted-foreground">
                  Tu disponibilidad habitual está completamente libre.
                </p>
              </div>
            ) : (
              blocks.map((block) => (
                <div
                  key={block.id}
                  className="group flex flex-col justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:border-red-200 dark:border-white/10 dark:bg-[#071713] dark:hover:border-red-400/30 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-accent-600 dark:text-accent-400">
                        {block.block_type === "custom"
                          ? "Horario"
                          : block.block_type === "day"
                          ? "Día"
                          : "Semana"}
                      </span>
                      {block.reason && (
                        <span className="truncate text-xs text-muted-foreground">
                          — {block.reason}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {block.block_type === "custom" ? (
                        <>
                          {formatDateTime(block.starts_at)} a{" "}
                          {new Date(block.ends_at).toLocaleTimeString("es-AR", {
                            timeZone: "America/Argentina/Buenos_Aires",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      ) : block.block_type === "day" ? (
                        formatDateOnly(block.starts_at)
                      ) : (
                        `Semana del ${formatDateOnly(block.starts_at)}`
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(block.id)}
                    disabled={deletingId === block.id}
                    className="flex shrink-0 items-center justify-center rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    aria-label="Eliminar bloqueo"
                    title="Eliminar bloqueo"
                  >
                    {deletingId === block.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

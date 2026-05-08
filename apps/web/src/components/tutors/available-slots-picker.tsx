"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { formatDay } from "./format";
import {
  addDaysYmd,
  formatDateInArgentina,
  formatTimeInArgentina,
  getTodayYmd,
  getWeekStartYmd,
} from "@/lib/timezone";

export interface AvailableSlot {
  start: string;
  end: string;
  day_of_week: number;
}

interface AvailableSlotsPickerProps {
  tutorId: string;
  durationMinutes: number;
  modality: string;
  selectedSlot: AvailableSlot | null;
  onSelectSlot: (slot: AvailableSlot | null) => void;
}

function formatShortDate(ymd: string) {
  // Use UTC midnight parse to get exactly the calendar date without timezone shift
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function AvailableSlotsPicker({
  tutorId,
  durationMinutes,
  modality,
  selectedSlot,
  onSelectSlot,
}: AvailableSlotsPickerProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayYmd = getTodayYmd();
  
  // Calculate from and to based on week offset
  // Base is the start of the current week
  const currentWeekStart = getWeekStartYmd(todayYmd);
  const fromYmd = addDaysYmd(currentWeekStart, weekOffset * 7);
  const toYmd = addDaysYmd(fromYmd, 6); // 7 days inclusive

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    onSelectSlot(null);

    try {
      const res = await fetch("/api/tutors/available-slots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tutor_id: tutorId,
          date_from: fromYmd,
          date_to: toYmd,
          duration_minutes: durationMinutes,
          modality,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudieron cargar los horarios.");
        setSlots([]);
      } else {
        setSlots(data.slots ?? []);
      }
    } catch {
      setError("Error de conexión.");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorId, durationMinutes, modality, weekOffset]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Group slots by ART-local YMD date string
  const slotsByDay = new Map<string, AvailableSlot[]>();
  for (let i = 0; i < 7; i++) {
    const key = addDaysYmd(fromYmd, i);
    slotsByDay.set(key, []);
  }
  
  for (const slot of slots) {
    // Get the YMD string directly from the start Date in Argentina timezone
    const key = formatDateInArgentina(new Date(slot.start));
    const daySlots = slotsByDay.get(key);
    if (daySlots) daySlots.push(slot);
  }

  const canGoPrev = weekOffset > 0;
  const canGoNext = weekOffset < 3; // max 4 weeks ahead

  const dayEntries = Array.from(slotsByDay.entries());

  return (
    <div className="space-y-4" aria-live="polite">
      {/* Week navigation */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-2 py-2 dark:border-white/10 dark:bg-white/[0.03]">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => setWeekOffset((o) => o - 1)}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/10 dark:focus-visible:ring-accent-300"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="text-center text-sm font-bold text-foreground">
          {formatShortDate(fromYmd)} – {formatShortDate(toYmd)}
        </p>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => setWeekOffset((o) => o + 1)}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/10 dark:focus-visible:ring-accent-300"
          aria-label="Semana siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Slots grid */}
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-8 dark:border-white/10 dark:bg-white/[0.03]">
          <Loader2 className="h-5 w-5 animate-spin text-accent-500" />
          <span className="ml-2 text-sm text-muted-foreground">
            Buscando horarios...
          </span>
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </p>
      ) : (
        <>
          <div className="space-y-2 sm:hidden">
            {dayEntries.map(([dateKey, daySlots]) => {
              const d = new Date(`${dateKey}T12:00:00Z`);
              const dow = d.getUTCDay();
              const isToday = dateKey === todayYmd;

              return (
                <section
                  key={`mobile-${dateKey}`}
                  className={`rounded-xl border p-3 ${
                    isToday
                      ? "border-accent-300 bg-accent-50/70 dark:border-accent-300/30 dark:bg-accent-300/10"
                      : "border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-foreground">
                      {formatDay(dow)}
                    </p>
                    <p
                      className={`text-xs font-semibold ${
                        isToday
                          ? "text-accent-700 dark:text-accent-100"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatShortDate(dateKey)}
                    </p>
                  </div>

                  {daySlots.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-muted-foreground dark:bg-white/[0.04]">
                      Sin horarios disponibles
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {daySlots.map((slot) => {
                        const isSelected = selectedSlot?.start === slot.start;
                        return (
                          <button
                            key={slot.start}
                            type="button"
                            onClick={() => onSelectSlot(isSelected ? null : slot)}
                            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:focus-visible:ring-accent-300 ${
                              isSelected
                                ? "bg-accent-600 text-white shadow-sm dark:bg-accent-300 dark:text-[#071713]"
                                : "border border-gray-200 bg-white text-foreground hover:border-accent-400 hover:bg-accent-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/30 dark:hover:bg-accent-300/10"
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {formatTimeInArgentina(new Date(slot.start))}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="hidden grid-cols-7 gap-1.5 sm:grid">
          {/* Day headers */}
          {dayEntries.map(([dateKey]) => {
            const d = new Date(`${dateKey}T12:00:00Z`);
            const dow = d.getUTCDay();
            const isToday = dateKey === todayYmd;
            return (
              <div
                key={`header-${dateKey}`}
                className="text-center"
              >
                <p
                  className={`text-xs font-semibold ${
                    isToday
                      ? "text-accent-600 dark:text-accent-300"
                      : "text-muted-foreground"
                  }`}
                >
                  {formatDay(dow, true)}
                </p>
                <p
                  className={`text-[11px] ${
                    isToday
                      ? "text-accent-600 dark:text-accent-300"
                      : "text-muted-foreground/70"
                  }`}
                >
                  {d.getUTCDate()}
                </p>
              </div>
            );
          })}

          {/* Slot columns */}
          {dayEntries.map(([dateKey, daySlots]) => (
            <div
              key={`slots-${dateKey}`}
              className="flex min-h-[60px] flex-col gap-1"
            >
              {daySlots.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <span className="text-[10px] text-muted-foreground/50">Sin horarios</span>
                </div>
              ) : (
                daySlots.map((slot) => {
                  const isSelected = selectedSlot?.start === slot.start;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() =>
                        onSelectSlot(isSelected ? null : slot)
                      }
                      className={`group flex min-h-8 items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:focus-visible:ring-accent-300 ${
                        isSelected
                          ? "bg-accent-600 text-white shadow-sm dark:bg-accent-300 dark:text-[#071713]"
                          : "border border-gray-200 bg-white text-foreground hover:border-accent-400 hover:bg-accent-50/50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/30 dark:hover:bg-accent-300/10"
                      }`}
                    >
                      <Clock
                        className={`h-3 w-3 shrink-0 ${
                          isSelected
                            ? "text-white/80 dark:text-[#071713]/70"
                            : "text-muted-foreground/60 group-hover:text-accent-500 dark:group-hover:text-accent-300/70"
                        }`}
                      />
                      {formatTimeInArgentina(new Date(slot.start))}
                    </button>
                  );
                })
              )}
            </div>
          ))}
          </div>
        </>
      )}

      {/* No slots message */}
      {!loading && !error && slots.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-3 text-center text-xs leading-5 text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
          No hay horarios disponibles esta semana. Probá otra semana o duración.
        </p>
      )}
    </div>
  );
}

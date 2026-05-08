"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { formatDay } from "./format";

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

function formatSlotTime(isoString: string) {
  const d = new Date(isoString);
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function getWeekRange(referenceDate: Date) {
  const from = new Date(referenceDate);
  from.setDate(from.getDate() - from.getDay() + 1); // Monday
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 6); // Sunday
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
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

  const now = new Date();
  const refDate = new Date(now);
  refDate.setDate(refDate.getDate() + weekOffset * 7);
  const { from, to } = getWeekRange(refDate);

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
          date_from: from.toLocaleDateString("sv-SE", {
            timeZone: "America/Argentina/Buenos_Aires",
          }),
          date_to: to.toLocaleDateString("sv-SE", {
            timeZone: "America/Argentina/Buenos_Aires",
          }),
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

  // Group slots by ART-local date (not UTC, since 23:00 ART = 02:00 UTC next day)
  const slotsByDay = new Map<string, AvailableSlot[]>();
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(from);
    dayDate.setDate(dayDate.getDate() + i);
    const key = dayDate.toLocaleDateString("sv-SE", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
    slotsByDay.set(key, []);
  }
  for (const slot of slots) {
    const key = new Date(slot.start).toLocaleDateString("sv-SE", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
    const daySlots = slotsByDay.get(key);
    if (daySlots) daySlots.push(slot);
  }

  const canGoPrev = weekOffset > 0;
  const canGoNext = weekOffset < 3; // max 4 weeks ahead

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => setWeekOffset((o) => o - 1)}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground disabled:opacity-30 dark:hover:bg-white/10"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="text-sm font-medium text-foreground">
          {formatShortDate(from)} – {formatShortDate(to)}
        </p>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => setWeekOffset((o) => o + 1)}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground disabled:opacity-30 dark:hover:bg-white/10"
          aria-label="Semana siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Slots grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-accent-500" />
          <span className="ml-2 text-sm text-muted-foreground">
            Buscando horarios...
          </span>
        </div>
      ) : error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </p>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {/* Day headers */}
          {Array.from(slotsByDay.entries()).map(([dateKey]) => {
            const d = new Date(dateKey + "T12:00:00Z");
            const dow = d.getUTCDay();
            const todayStr = now.toLocaleDateString("sv-SE", {
              timeZone: "America/Argentina/Buenos_Aires",
            });
            const isToday = dateKey === todayStr;
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
          {Array.from(slotsByDay.entries()).map(([dateKey, daySlots]) => (
            <div
              key={`slots-${dateKey}`}
              className="flex flex-col gap-1 min-h-[60px]"
            >
              {daySlots.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <span className="text-[10px] text-muted-foreground/40">—</span>
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
                      className={`group flex items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-all ${
                        isSelected
                          ? "bg-accent-600 text-white shadow-sm dark:bg-accent-300 dark:text-[#071713]"
                          : "border border-gray-200 text-foreground hover:border-accent-400 hover:bg-accent-50/50 dark:border-white/10 dark:hover:border-accent-300/30 dark:hover:bg-accent-300/5"
                      }`}
                    >
                      <Clock
                        className={`h-3 w-3 shrink-0 ${
                          isSelected
                            ? "text-white/80 dark:text-[#071713]/70"
                            : "text-muted-foreground/60 group-hover:text-accent-500 dark:group-hover:text-accent-300/70"
                        }`}
                      />
                      {formatSlotTime(slot.start)}
                    </button>
                  );
                })
              )}
            </div>
          ))}
        </div>
      )}

      {/* No slots message */}
      {!loading && !error && slots.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          No hay horarios disponibles esta semana. Probá otra semana o duración.
        </p>
      )}
    </div>
  );
}

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

function pickDefaultDayKey(
  dayEntries: [string, AvailableSlot[]][],
  todayYmd: string
) {
  if (dayEntries.some(([dateKey]) => dateKey === todayYmd)) {
    return todayYmd;
  }

  return (
    dayEntries.find(([, daySlots]) => daySlots.length > 0)?.[0] ??
    dayEntries[0]?.[0] ??
    null
  );
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
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

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
  const defaultDayKey = pickDefaultDayKey(dayEntries, todayYmd);
  const selectedSlotDayKey = selectedSlot
    ? formatDateInArgentina(new Date(selectedSlot.start))
    : null;
  const activeDayKey =
    selectedSlotDayKey && slotsByDay.has(selectedSlotDayKey)
      ? selectedSlotDayKey
      : selectedDayKey && slotsByDay.has(selectedDayKey)
        ? selectedDayKey
        : defaultDayKey;
  const activeDaySlots = activeDayKey ? slotsByDay.get(activeDayKey) ?? [] : [];
  const activeDayDate = activeDayKey
    ? new Date(`${activeDayKey}T12:00:00Z`)
    : null;
  const activeDayName = activeDayDate
    ? formatDay(activeDayDate.getUTCDay())
    : "este día";

  function selectDay(dateKey: string) {
    setSelectedDayKey(dateKey);
    if (selectedSlotDayKey && selectedSlotDayKey !== dateKey) {
      onSelectSlot(null);
    }
  }

  useEffect(() => {
    setSelectedDayKey(defaultDayKey);
  }, [defaultDayKey, fromYmd, toYmd, tutorId, durationMinutes, modality]);

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

        <div className="text-center">
          <p className="text-sm font-bold text-foreground">
            Semana del {formatShortDate(fromYmd)} al {formatShortDate(toYmd)}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">
            Podés revisar hasta 4 semanas hacia adelante
          </p>
        </div>

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
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-foreground">Elegí un día</p>
              {slots.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground">
                  {slots.length} horario{slots.length === 1 ? "" : "s"} en la semana
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {dayEntries.map(([dateKey, daySlots]) => {
                const d = new Date(`${dateKey}T12:00:00Z`);
                const dow = d.getUTCDay();
                const isToday = dateKey === todayYmd;
                const isActive = activeDayKey === dateKey;
                const hasSlots = daySlots.length > 0;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    disabled={!hasSlots}
                    aria-pressed={isActive}
                    onClick={() => selectDay(dateKey)}
                    className={`min-h-[104px] rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed dark:focus-visible:ring-accent-300 ${
                      isActive
                        ? "border-accent-600 bg-accent-50 text-foreground ring-1 ring-accent-200 dark:border-accent-300 dark:bg-accent-300/10 dark:ring-accent-300/20"
                        : hasSlots
                          ? "border-gray-200 bg-white text-foreground hover:border-accent-300 hover:bg-accent-50/50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-300/35 dark:hover:bg-accent-300/10"
                          : "border-gray-200 bg-gray-50 text-muted-foreground opacity-70 dark:border-white/10 dark:bg-white/[0.02]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span>
                        <span className="block text-sm font-bold">
                          {formatDay(dow)}
                        </span>
                        <span
                          className={`mt-0.5 block text-xs font-semibold ${
                            isToday
                              ? "text-accent-700 dark:text-accent-100"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatShortDate(dateKey)}
                        </span>
                      </span>
                      {isToday && (
                        <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-700 dark:bg-accent-300/20 dark:text-accent-100">
                          Hoy
                        </span>
                      )}
                    </span>

                    {hasSlots ? (
                      <span className="mt-3 block">
                        <span className="block text-xs font-bold text-accent-700 dark:text-accent-100">
                          {daySlots.length} horario
                          {daySlots.length === 1 ? "" : "s"}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          Desde {formatTimeInArgentina(new Date(daySlots[0].start))}
                        </span>
                      </span>
                    ) : (
                      <span className="mt-3 block text-xs font-semibold text-muted-foreground">
                        Sin horarios
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">
                  Horarios para {activeDayName}
                  {activeDayKey ? ` ${formatShortDate(activeDayKey)}` : ""}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Elegí una hora para continuar con el pago.
                </p>
              </div>
              {activeDaySlots.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground">
                  {activeDaySlots.length} opción{activeDaySlots.length === 1 ? "" : "es"}
                </p>
              )}
            </div>

            {activeDaySlots.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-sm font-semibold text-foreground">
                  No hay horarios para este día.
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Probá otro día, semana, duración o modalidad.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {activeDaySlots.map((slot) => {
                  const isSelected = selectedSlot?.start === slot.start;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => onSelectSlot(isSelected ? null : slot)}
                      className={`group flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:focus-visible:ring-accent-300 ${
                        isSelected
                          ? "bg-accent-600 text-white shadow-sm dark:bg-accent-300 dark:text-[#071713]"
                          : "border border-gray-200 bg-white text-foreground hover:border-accent-400 hover:bg-accent-50/70 dark:border-white/10 dark:bg-[#071713] dark:hover:border-accent-300/35 dark:hover:bg-accent-300/10"
                      }`}
                    >
                      <Clock
                        className={`h-4 w-4 shrink-0 ${
                          isSelected
                            ? "text-white/80 dark:text-[#071713]/70"
                            : "text-muted-foreground/60 group-hover:text-accent-500 dark:group-hover:text-accent-300/70"
                        }`}
                      />
                      {formatTimeInArgentina(new Date(slot.start))}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

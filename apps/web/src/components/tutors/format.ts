import type { TutorAvailabilitySlot } from "./types";

const DAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const DAY_SHORT_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function formatArs(value: number) {
  return value.toLocaleString("es-AR");
}

export function formatTime(value: string) {
  return value.slice(0, 5);
}

export function formatDay(value: number, short = false) {
  return (short ? DAY_SHORT_LABELS : DAY_LABELS)[value] ?? "Día";
}

export function formatModality(value: string) {
  if (value === "online") return "Online";
  if (value === "presencial") return "Presencial";
  return "Online y presencial";
}

export function summarizeModalities(slots: TutorAvailabilitySlot[]) {
  const modalities = new Set(slots.map((slot) => slot.modality));
  if (modalities.has("ambas")) return "Online y presencial";

  const labels = Array.from(modalities).map(formatModality);
  if (labels.length === 0) return "Modalidad a coordinar";
  return labels.join(" · ");
}

export function summarizeAvailability(slots: TutorAvailabilitySlot[]) {
  if (slots.length === 0) return "Horarios a coordinar";

  return slots
    .slice(0, 2)
    .map(
      (slot) =>
        `${formatDay(slot.day_of_week, true)} ${formatTime(slot.start_time)}-${formatTime(slot.end_time)}`
    )
    .join(" · ");
}


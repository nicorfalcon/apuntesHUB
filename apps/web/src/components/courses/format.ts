export function formatArs(value: number) {
  return value.toLocaleString("es-AR");
}

export function formatCourseType(value: string) {
  if (value === "curso_completo") return "Curso completo";
  if (value === "repaso_final") return "Repaso final";
  if (value === "resolucion_tps") return "Resolución de TPs";
  return "Curso";
}

export function shortCourseType(value: string) {
  if (value === "curso_completo") return "Curso";
  if (value === "repaso_final") return "Final";
  if (value === "resolucion_tps") return "TPs";
  return "Clase";
}

export function formatDuration(totalSeconds: number) {
  if (!totalSeconds || totalSeconds < 60) return "Sin duración";

  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

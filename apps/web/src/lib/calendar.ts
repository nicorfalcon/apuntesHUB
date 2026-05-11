export interface CalendarEventParams {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  durationMinutes: number;
  uid?: string;
}

function formatCalendarDate(date: Date) {
  return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
}

export function generateGoogleCalendarUrl({
  title,
  description,
  location,
  startDate,
  durationMinutes,
}: CalendarEventParams) {
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

  const startStr = formatCalendarDate(startDate);
  const endStr = formatCalendarDate(endDate);

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title);
  url.searchParams.set("dates", `${startStr}/${endStr}`);
  url.searchParams.set("details", description);
  url.searchParams.set("location", location);

  return url.toString();
}

export function generateIcsContent({
  title,
  description,
  location,
  startDate,
  durationMinutes,
  uid,
}: CalendarEventParams) {
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  const now = new Date();

  // Escape special characters for ICS
  const escapeIcs = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ApuntesHub//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid || crypto.randomUUID()}@apunteshub.com`,
    `DTSTAMP:${formatCalendarDate(now)}`,
    `DTSTART:${formatCalendarDate(startDate)}`,
    `DTEND:${formatCalendarDate(endDate)}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

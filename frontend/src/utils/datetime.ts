function toDateSafe(value: string): Date | null {
  if (!value) return null;

  const normalized = value.trim().replace(" ", "T");
  const localDateMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );

  // Parse DB-like date strings as local time to avoid timezone shifting.
  if (localDateMatch) {
    const [, year, month, day, hours = "0", minutes = "0", seconds = "0"] = localDateMatch;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTime(value: string): string {
  const parsed = toDateSafe(value);
  if (!parsed) return value || "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function formatDate(value: string): string {
  const parsed = toDateSafe(value);
  if (!parsed) return value || "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export function formatTime(value: string): string {
  const parsed = toDateSafe(value);
  if (!parsed) return value || "—";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

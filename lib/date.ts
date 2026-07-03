/**
 * Device-local date utilities for Vitia.
 * All dates are YYYY-MM-DD strings in the device's local timezone.
 * No external date library dependency — plain JS Date is sufficient
 * for a single-user personal app with no cross-timezone requirements.
 */

/**
 * Return today's date as an ISO 8601 date string (YYYY-MM-DD) in device-local time.
 */
export function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a YYYY-MM-DD date string for display in the DateNavigator.
 * Returns "Hoy" when the date equals today, otherwise "DD MMM" (e.g. "20 Jun").
 *
 * Month abbreviations are in Spanish to match the Spanish locale of the app.
 */
export function formatDayLabel(isoDate: string): string {
  if (isoDate === todayISO()) {
    return "Hoy";
  }

  const MONTHS_ES = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];

  // Parse the date parts directly to avoid timezone shifting from new Date(isoDate).
  const [, monthStr, dayStr] = isoDate.split("-");
  const monthIndex = Number.parseInt(monthStr, 10) - 1;
  const day = Number.parseInt(dayStr, 10);

  return `${day} ${MONTHS_ES[monthIndex]}`;
}

/**
 * Return the ISO date (YYYY-MM-DD) of the Monday that starts the week
 * containing the given date. Uses (getDay()+6)%7 to convert Sunday=0 to
 * a Monday-first offset.
 */
export function startOfWeek(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
  // Monday offset: (getDay()+6)%7 → Mon=0, Tue=1, ..., Sun=6
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Return an array of exactly 7 ISO dates (YYYY-MM-DD) starting from the
 * given Monday (weekStart) through the following Sunday.
 */
export function weekDays(weekStart: string): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(weekStart, i));
  }
  return days;
}

/**
 * Format a YYYY-MM-DD date string for the week strip header label.
 * Returns "Hoy" when the date equals today, otherwise "D mmm" in
 * Spanish (e.g. "2 jul") with no leading zero and no year.
 */
export function formatFullDayLabel(isoDate: string): string {
  if (isoDate === todayISO()) {
    return "Hoy";
  }

  const MONTHS_ES_SHORT = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];

  const [, monthStr, dayStr] = isoDate.split("-");
  const monthIndex = Number.parseInt(monthStr, 10) - 1;
  const day = Number.parseInt(dayStr, 10);

  return `${day} ${MONTHS_ES_SHORT[monthIndex]}`;
}

/**
 * Add a number of days to a YYYY-MM-DD date string and return the new string.
 * Use negative delta to go back, positive to go forward.
 */
export function addDays(isoDate: string, delta: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

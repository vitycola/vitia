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

/**
 * Return an inclusive rolling window of `days` days ending at `today`
 * (defaults to `todayISO()`). E.g. rollingWindow(30) covers today and the
 * 29 days before it — NOT a calendar-aligned month/quarter.
 */
export function rollingWindow(
  days: number,
  today: string = todayISO()
): { from: string; to: string } {
  return { from: addDays(today, -(days - 1)), to: today };
}

/**
 * Dashboard range identifier shared by the Progress dashboards. Defined
 * locally (not imported from stores/useProgressStore.ts) so lib/ never
 * depends on stores/ — the store's DashboardRange type is structurally
 * identical and TypeScript unifies them by shape.
 */
type DashboardRangeWindow = "week" | "month" | "3month";

/**
 * Resolve the {from, to} fetch window for a given dashboard range. All
 * ranges are rolling windows ending today: week = 7 days, month = 30 days,
 * 3month = 90 days. Shared by useCalorieDashboard, useMeasurementsDashboard,
 * and useWeightDashboard so the window never diverges between cards.
 */
export function resolveDashboardWindow(range: DashboardRangeWindow): {
  from: string;
  to: string;
} {
  if (range === "week") {
    return rollingWindow(7);
  }
  if (range === "month") {
    return rollingWindow(30);
  }
  return rollingWindow(90);
}

/**
 * Return an inclusive list of ISO dates (YYYY-MM-DD) from `from` through `to`.
 */
export function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/**
 * Split an inclusive date range into sequential buckets of `size` days each,
 * oldest to newest. Assumes the range length is an exact multiple of `size`.
 */
export function splitBuckets(
  from: string,
  to: string,
  size: number
): { from: string; to: string }[] {
  const buckets: { from: string; to: string }[] = [];
  let bucketStart = from;
  while (bucketStart <= to) {
    const bucketEnd = addDays(bucketStart, size - 1);
    buckets.push({ from: bucketStart, to: bucketEnd });
    bucketStart = addDays(bucketEnd, 1);
  }
  return buckets;
}

const MONTHS_ES_FULL = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/**
 * Format a date string (accepts YYYY-MM or YYYY-MM-DD) into a capitalized
 * es-AR "Month Year" label (e.g. "Julio 2026") for gallery month-section
 * headers. Parses the date parts directly (no `new Date(isoDate)`) to avoid
 * timezone shifting, matching the other formatters in this module.
 */
export function formatMonthLabel(isoDate: string): string {
  const [yearStr, monthStr] = isoDate.split("-");
  const monthIndex = Number.parseInt(monthStr, 10) - 1;
  return `${MONTHS_ES_FULL[monthIndex]} ${yearStr}`;
}

const BUCKET_LABELS = ["Hace 61-90 días", "Hace 31-60 días", "Últimos 30 días"];

/**
 * Return the relative label for a 3-Month bucket index (0 = oldest,
 * 2 = most recent). Labels are date-independent by design — rolling 90-day
 * windows rarely align with calendar months.
 */
export function relativeBucketLabel(bucketIndex: number): string {
  return BUCKET_LABELS[bucketIndex];
}

/**
 * Formats a date string (ISO or YYYY-MM-DD) to dd/MM using LOCAL timezone.
 * Avoids UTC shift that causes dates to appear as the previous day in Brazil (UTC-3).
 */
export function formatDayMonth(dateStr: string): string {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

/**
 * Parses a YYYY-MM-DD string as a LOCAL date to avoid UTC off-by-one issues.
 */
export function parseDateStringLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Returns today's date as YYYY-MM-DD in local timezone.
 */
export function todayLocalString(): string {
  const d = new Date();
  return formatDateString(d);
}

/**
 * Formats a Date object to YYYY-MM-DD using local timezone components.
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the most recent startDay on or before the given local date.
 * 0 = Sunday, 1 = Monday, 3 = Wednesday, etc.
 */
export function getWeekStart(referenceDate: Date, startDay = 0): Date {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diff = (start.getDay() - startDay + 7) % 7;
  start.setDate(start.getDate() - diff);
  return start;
}

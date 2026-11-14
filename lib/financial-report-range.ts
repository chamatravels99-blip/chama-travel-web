export type FinancialReportRange = {
  startDate: string;
  endDate: string;
};

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseFinancialReportRange(start: string | null, end: string | null): FinancialReportRange | null {
  if (!start || !end || !isCalendarDate(start) || !isCalendarDate(end) || start > end) return null;
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
  if (!Number.isInteger(days) || days > 3660) return null;
  return { startDate: start, endDate: end };
}

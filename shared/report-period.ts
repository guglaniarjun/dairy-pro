import { addDays } from "./care";

export type ReportPeriod = "daily" | "morning" | "evening";

// Dates selected in the briefing UI are delivery dates; legacy daily dates remain covered dates.
export function coveredReportDate(date: string, period: ReportPeriod) {
  return period === "morning" ? addDays(date, -1) : date;
}

export function matchesReportIdentity(saved: any, date: string, period: ReportPeriod) {
  const actualPeriod = saved.period || saved.snapshot?.briefing?.period || "daily";
  if (actualPeriod !== period || saved.date !== coveredReportDate(date, period)) return false;
  return period === "daily" || (saved.briefingDate || saved.snapshot?.briefing?.date) === date;
}

// Independent cursors prevent one period from skipping or recreating the other period.
export function dueReportDates(start: string, last: string | null, today: string, time: string, cutoff: string, limit = 31) {
  const through = time >= cutoff ? today : addDays(today, -1);
  const dates: string[] = [];
  for (let day = last ? addDays(last, 1) : start; day <= through && dates.length < limit; day = addDays(day, 1)) dates.push(day);
  return dates;
}

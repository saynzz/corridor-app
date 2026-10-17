export const TZ_LABEL = "SGT (UTC+8)";
const OFFSET_MS = 8 * 3600 * 1000;
export const CUTOFF_HOUR = 15;
export const HOLIDAYS = ["2026-12-25", "2027-01-01"];

function sgtParts(d: Date) {
  const x = new Date(d.getTime() + OFFSET_MS);
  return { date: x.toISOString().slice(0, 10), hour: x.getUTCHours(), dow: x.getUTCDay() };
}

function dow(date: string) {
  return new Date(date + "T00:00:00Z").getUTCDay();
}

export function isBusinessDay(date: string) {
  const d = dow(date);
  return d !== 0 && d !== 6 && !HOLIDAYS.includes(date);
}

function nextDay(date: string) {
  return new Date(Date.parse(date + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
}
function prevDay(date: string) {
  return new Date(Date.parse(date + "T00:00:00Z") - 864e5).toISOString().slice(0, 10);
}

export function todaySgt(now = new Date()) {
  return sgtParts(now).date;
}

export function effectiveStart(now = new Date()) {
  const p = sgtParts(now);
  let d = p.date;
  if (!isBusinessDay(d) || p.hour >= CUTOFF_HOUR) {
    d = nextDay(d);
    while (!isBusinessDay(d)) d = nextDay(d);
  }
  return d;
}

export function addBusinessDays(date: string, n: number) {
  let d = date;
  let left = Math.abs(n);
  const step = n >= 0 ? nextDay : prevDay;
  while (left > 0) {
    d = step(d);
    if (isBusinessDay(d)) left--;
  }
  return d;
}

export function businessDaysBetween(from: string, to: string): number {
  if (to <= from) return -businessDaysBetween(to, from);
  let n = 0;
  let d = from;
  while (d < to) {
    d = nextDay(d);
    if (isBusinessDay(d)) n++;
  }
  return n;
}

export function fmtSgt(iso: string) {
  const x = new Date(Date.parse(iso) + OFFSET_MS);
  const date = x.toISOString().slice(0, 10);
  const time = x.toISOString().slice(11, 16);
  return `${date} ${time} SGT`;
}

export function fmtDate(date: string) {
  return `${date} (${TZ_LABEL})`;
}

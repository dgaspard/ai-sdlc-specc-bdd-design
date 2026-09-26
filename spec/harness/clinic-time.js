// Clinic-time helpers: feature files speak Central Time; APIs use ISO 8601 with offset.
// America/Chicago follows daylight saving, so the offset is computed, never hard-coded.
const ZONE = "America/Chicago";

function offsetMinutes(utcMs) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, timeZoneName: "shortOffset" })
    .formatToParts(new Date(utcMs)).find((p) => p.type === "timeZoneName").value; // e.g. "GMT-5"
  const m = part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
}

const pad = (n) => String(n).padStart(2, "0");

/** "2026-10-05 09:00" (Central) -> "2026-10-05T09:00:00-05:00". */
export function central(localDateTime) {
  const [d, t = "00:00"] = localDateTime.trim().split(/[ T]/);
  const asUtc = Date.parse(`${d}T${t.length === 5 ? `${t}:00` : t}Z`);
  let off = offsetMinutes(asUtc);
  off = offsetMinutes(asUtc - off * 60000); // settle across a DST boundary
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  return `${d}T${t.length === 5 ? `${t}:00` : t}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Central date and "HH:MM" -> ISO with offset. */
export const centralAt = (date, hhmm) => central(`${date} ${hhmm}`);

/** Epoch milliseconds of an ISO timestamp, for comparing instants regardless of offset. */
export const instant = (iso) => Date.parse(iso);

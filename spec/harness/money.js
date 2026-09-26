// Money helpers: feature files show "$1,234.50"; APIs use integer cents (USD).
export function cents(text) {
  const m = String(text).trim().match(/^(-)?\$?([\d,]+)(?:\.(\d{2}))?$/);
  if (!m) throw new Error(`Not a USD amount: ${text}`);
  const value = Number(m[2].replace(/,/g, "")) * 100 + Number(m[3] ?? 0);
  return m[1] ? -value : value;
}

/** 123450 -> "$1,234.50" (D-27 format). */
export function usd(centsValue) {
  const sign = centsValue < 0 ? "-" : "";
  const abs = Math.abs(centsValue);
  return `${sign}$${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
}

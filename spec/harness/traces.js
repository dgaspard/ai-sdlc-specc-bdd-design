// Test helpers for reading spans from the OTLP test collector. Protected scaffolding.
import { projectUrl } from "./config.js";

export const TRACE_WAIT_MS = 5000;

/** Returns { spans, rejected } matching optional filters { traceId, service, name }. */
export async function fetchSpans(filter = {}) {
  const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
  const res = await fetch(`${projectUrl("collector")}/test/spans${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`collector returned ${res.status}`);
  return res.json();
}

/** Polls until predicate(spans) is truthy or TRACE_WAIT_MS passes; returns matching spans. */
export async function waitForSpans(filter = {}, predicate = (s) => s.length > 0, timeoutMs = TRACE_WAIT_MS) {
  const deadline = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    last = (await fetchSpans(filter)).spans;
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Expected spans ${JSON.stringify(filter)} did not arrive within ${timeoutMs} ms (saw ${last.length})`);
}

export function findSpan(spans, name) {
  return spans.find((s) => s.name === name) ?? null;
}

/** True when child's parent is parent, even across services. */
export function isChildOf(child, parent) {
  return child.traceId === parent.traceId && child.parentSpanId === parent.spanId;
}

/** Indented text tree of one trace: service, span name, outcome, duration. */
export function traceTree(spans) {
  const byParent = new Map();
  const ids = new Set(spans.map((s) => s.spanId));
  for (const s of spans) {
    const key = s.parentSpanId && ids.has(s.parentSpanId) ? s.parentSpanId : "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(s);
  }
  const lines = [];
  const walk = (key, depth) => {
    for (const s of (byParent.get(key) ?? []).sort((a, b) => (BigInt(a.startTimeUnixNano) < BigInt(b.startTimeUnixNano) ? -1 : 1))) {
      const ms = Number(BigInt(s.endTimeUnixNano) - BigInt(s.startTimeUnixNano)) / 1e6;
      const outcome = s.attributes["petclinic.operation.outcome"];
      lines.push(`${"  ".repeat(depth)}${s.serviceName ?? "?"}  ${s.name}  [${s.kind}${outcome ? ` ${outcome}` : ""} ${s.status.code}]  ${ms.toFixed(1)} ms`);
      walk(s.spanId, depth + 1);
    }
  };
  walk("root", 0);
  return lines.join("\n");
}

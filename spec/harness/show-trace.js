#!/usr/bin/env node
// Prints a trace from the running OTLP test collector as an indented tree.
// Usage: node spec/harness/show-trace.js [traceId]   (default: most recent trace)
import { fetchSpans, traceTree } from "./traces.js";

const { spans, rejected } = await fetchSpans();
if (rejected.length) console.log(`Warning: ${rejected.length} export(s) rejected (not protobuf).`);
if (!spans.length) { console.log("No spans received."); process.exit(0); }
const traceId = process.argv[2] ?? spans.reduce((a, b) => (BigInt(b.startTimeUnixNano) > BigInt(a.startTimeUnixNano) ? b : a)).traceId;
const trace = spans.filter((s) => s.traceId === traceId);
console.log(`Trace ${traceId} (${trace.length} spans)\n${traceTree(trace)}`);

/**
 * Reads one value from a Prometheus text exposition, e.g. the counter
 * orders_processed_total{outcome="duplicate"}. Missing series read as 0 (a counter that never moved).
 */
export function metricValue(text: string, name: string, labels: Record<string, string> = {}): number {
  let total = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.startsWith(name)) continue;
    const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([0-9.eE+-]+)/.exec(line);
    if (!match || match[1] !== name) continue;
    const series = match[2] ?? '';
    if (Object.entries(labels).every(([k, v]) => series.includes(`${k}="${v}"`))) total += Number(match[3]);
  }
  return total;
}

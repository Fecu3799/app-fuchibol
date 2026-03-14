import { Injectable } from '@nestjs/common';

type LabelSet = Record<string, string>;

const HISTOGRAM_BUCKETS = [
  10, 25, 50, 100, 250, 500, 1000, 2500, 5000,
] as const;

function escapeLabel(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function serializeLabels(labels: LabelSet): string {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return '';
  return (
    '{' + entries.map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(',') + '}'
  );
}

function withLabel(labels: LabelSet, key: string, value: string): LabelSet {
  return { ...labels, [key]: value };
}

interface CounterEntry {
  labels: LabelSet;
  value: number;
}

interface HistogramEntry {
  labels: LabelSet;
  buckets: number[]; // HISTOGRAM_BUCKETS.length + 1 for +Inf
  sum: number;
  count: number;
}

const COUNTER_HELP: Record<string, string> = {
  match_created_total: 'Total matches created',
  match_confirm_total: 'Total participant confirm actions',
  match_leave_total: 'Total match leave actions',
  match_waitlist_promotions_total: 'Total waitlist to confirmed promotions',
  match_revision_conflicts_total: 'Total optimistic lock revision conflicts',
  match_major_changes_total:
    'Total major match changes triggering reconfirmation',
  auth_login_success_total: 'Total successful logins',
  auth_login_failed_total: 'Total failed login attempts',
  auth_refresh_success_total: 'Total successful token refreshes',
  auth_refresh_reuse_total: 'Total refresh token reuse detections',
  chat_messages_sent_total: 'Total chat messages persisted',
  chat_messages_deduplicated_total: 'Total deduplicated chat messages replayed',
  chat_socket_emit_failures_total:
    'Total socket emit failures (server not initialized)',
  cron_jobs_runs_total: 'Total cron lifecycle job ticks executed',
  cron_jobs_failures_total: 'Total cron job per-match processing failures',
  match_lifecycle_transitions_total:
    'Total automatic match lifecycle state transitions',
};

const HISTOGRAM_HELP: Record<string, string> = {
  http_request_duration_ms: 'HTTP request duration in milliseconds',
};

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, Map<string, CounterEntry>>();
  private readonly histograms = new Map<string, Map<string, HistogramEntry>>();

  constructor() {
    // Pre-initialize all known counters so /metrics always lists them (value 0)
    for (const name of Object.keys(COUNTER_HELP)) {
      this.counters.set(name, new Map());
    }
  }

  incCounter(name: string, labels: LabelSet = {}): void {
    if (!this.counters.has(name)) this.counters.set(name, new Map());
    const series = this.counters.get(name)!;
    const key = serializeLabels(labels);
    const entry = series.get(key);
    if (entry) {
      entry.value++;
    } else {
      series.set(key, { labels, value: 1 });
    }
  }

  observeHistogram(name: string, value: number, labels: LabelSet = {}): void {
    if (!this.histograms.has(name)) this.histograms.set(name, new Map());
    const series = this.histograms.get(name)!;
    const key = serializeLabels(labels);
    let entry = series.get(key);
    if (!entry) {
      entry = {
        labels,
        buckets: new Array(HISTOGRAM_BUCKETS.length + 1).fill(0) as number[],
        sum: 0,
        count: 0,
      };
      series.set(key, entry);
    }
    for (let i = 0; i < HISTOGRAM_BUCKETS.length; i++) {
      if (value <= HISTOGRAM_BUCKETS[i]) entry.buckets[i]++;
    }
    entry.buckets[HISTOGRAM_BUCKETS.length]++; // +Inf always increments
    entry.sum += value;
    entry.count++;
  }

  render(): string {
    const lines: string[] = [];

    for (const [name, series] of this.counters) {
      lines.push(`# HELP ${name} ${COUNTER_HELP[name] ?? name}`);
      lines.push(`# TYPE ${name} counter`);
      if (series.size === 0) {
        lines.push(`${name} 0`);
      } else {
        for (const entry of series.values()) {
          lines.push(`${name}${serializeLabels(entry.labels)} ${entry.value}`);
        }
      }
    }

    for (const [name, series] of this.histograms) {
      lines.push(`# HELP ${name} ${HISTOGRAM_HELP[name] ?? name}`);
      lines.push(`# TYPE ${name} histogram`);
      for (const entry of series.values()) {
        for (let i = 0; i < HISTOGRAM_BUCKETS.length; i++) {
          const le = String(HISTOGRAM_BUCKETS[i]);
          lines.push(
            `${name}_bucket${serializeLabels(withLabel(entry.labels, 'le', le))} ${entry.buckets[i]}`,
          );
        }
        lines.push(
          `${name}_bucket${serializeLabels(withLabel(entry.labels, 'le', '+Inf'))} ${entry.buckets[HISTOGRAM_BUCKETS.length]}`,
        );
        lines.push(`${name}_sum${serializeLabels(entry.labels)} ${entry.sum}`);
        lines.push(
          `${name}_count${serializeLabels(entry.labels)} ${entry.count}`,
        );
      }
    }

    return lines.join('\n') + '\n';
  }
}

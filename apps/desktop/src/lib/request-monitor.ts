import type { MonitoredRequest } from './types';

export interface MonitorFilters {
  days: number;
  model: string;
  provider: string;
  result: '' | 'success' | 'error';
}

export function requestSucceeded(record: MonitoredRequest) {
  return (
    record.status >= 200 &&
    record.status < 300 &&
    (!record.streamState || record.streamState === 'completed')
  );
}

export function filterRequests(records: MonitoredRequest[], filters: MonitorFilters, now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - filters.days + 1);
  return records.filter((record) => {
    const at = new Date(record.startedAt).getTime();
    return (
      at >= start.getTime() &&
      at <= now.getTime() &&
      (!filters.model || record.model === filters.model) &&
      (!filters.provider || record.providerHash === filters.provider) &&
      (!filters.result || requestSucceeded(record) === (filters.result === 'success'))
    );
  });
}

export function monitorSummary(records: MonitoredRequest[]) {
  // Retried requests may have unreported usage from earlier attempts.
  const cacheSamples = records.filter(
    (record) =>
      record.retryCount === 0 &&
      record.usage?.inputTokens != null &&
      record.usage.outputTokens != null &&
      record.usage.cachedInputTokens != null,
  );
  const input = cacheSamples.reduce((sum, record) => sum + record.usage!.inputTokens!, 0);
  const cached = cacheSamples.reduce((sum, record) => sum + record.usage!.cachedInputTokens!, 0);
  const times = records
    .flatMap((record) => (record.ttftMs == null ? [] : [record.ttftMs]))
    .sort((a, b) => a - b);
  const mid = Math.floor(times.length / 2);
  return {
    cacheSamples: cacheSamples.length,
    cacheRate: input > 0 ? cached / input : null,
    firstContentSamples: times.length,
    firstContentMs: times.length
      ? (times[mid] + times[Math.floor((times.length - 1) / 2)]) / 2
      : null,
  };
}

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function activityDays(records: MonitoredRequest[], count: number, now: Date) {
  const counts = new Map<string, number>();
  records.forEach((record) => {
    const key = localDay(new Date(record.startedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - count + index + 1);
    const key = localDay(date);
    const value = counts.get(key) ?? 0;
    return {
      date: key,
      count: value,
      label: `${key}: ${value ? `${value} recorded requests` : 'No recorded requests; coverage unknown'}`,
    };
  });
}

export function durationLabel(ms: number | null | undefined) {
  if (ms == null) return '—';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

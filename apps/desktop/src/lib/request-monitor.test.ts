import { describe, expect, it } from 'vitest';
import { monitorSummary, filterRequests, activityDays } from './request-monitor';
import type { MonitoredRequest } from './types';

const row = (id: string, usage: MonitoredRequest['usage'], extra = {}): MonitoredRequest => ({
  requestId: id,
  recordId: id,
  startedAt: '2026-10-26T09:00:00Z',
  model: 'model-a',
  profileHash: 'a',
  providerHash: 'p',
  status: 200,
  latencyMs: 1000,
  ttftMs: null,
  headersMs: 2,
  retryCount: 0,
  streamState: 'completed',
  outcomeCode: null,
  usage,
  ...extra,
});

describe('observed request metrics', () => {
  it('uses only complete cache samples and preserves unknown and explicit zero', () => {
    const records = [
      row('one', { inputTokens: 100, outputTokens: 20, totalTokens: 120, cachedInputTokens: 50 }),
      row('two', { inputTokens: 100, outputTokens: 30, totalTokens: 130, cachedInputTokens: 0 }),
      row('missing', { inputTokens: 900, outputTokens: null, totalTokens: null }),
      row(
        'retry',
        { inputTokens: 800, outputTokens: 30, totalTokens: 830, cachedInputTokens: 700 },
        { retryCount: 1 },
      ),
      row('unknown', null),
    ];
    const summary = monitorSummary(records);
    expect(summary.cacheRate).toBe(0.25);
    expect(summary.cacheSamples).toBe(2);
    expect(summary.firstContentMs).toBeNull();
    expect(monitorSummary([row('unknown', null)]).cacheRate).toBeNull();
    expect(
      monitorSummary([row('zero', { inputTokens: 10, outputTokens: 0, cachedInputTokens: 0 })])
        .cacheRate,
    ).toBe(0);
  });

  it('computes first content median from measured samples including zero', () => {
    const summary = monitorSummary([
      row('one', null, { ttftMs: 0 }),
      row('two', null, { ttftMs: 100 }),
      row('unknown', null),
    ]);
    expect(summary.firstContentMs).toBe(50);
    expect(summary.firstContentSamples).toBe(2);
  });

  it('filters by local day, model, provider and actual stream result', () => {
    const records = [
      row('good', null),
      row('failed', null, { streamState: 'failed' }),
      row('old', null, { startedAt: '2026-10-20T09:00:00Z' }),
    ];
    const filters = { days: 1, model: '', provider: '', result: 'error' as const };
    const now = new Date('2026-10-26T12:00:00Z');
    expect(filterRequests(records, filters, now).map((r) => r.requestId)).toEqual(['failed']);
    expect(filterRequests(records, { ...filters, model: 'different' }, now)).toEqual([]);
    const days = activityDays(records.slice(0, 2), 7, now);
    expect(days).toHaveLength(7);
    expect(days.filter((day) => day.count > 0).map((day) => day.count)).toEqual([2]);
    expect(
      days
        .filter((day) => day.count === 0)
        .every((day) => day.label.includes('No recorded requests')),
    ).toBe(true);
  });
});

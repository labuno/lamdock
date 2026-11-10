import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as api from '../lib/api';
import type { AntigravityQuotaResponse } from '../lib/types';
import { useAntigravityQuota } from './use-antigravity-quota';

vi.mock('../lib/api', () => ({
  inTauri: vi.fn(() => true),
  getAntigravityPort: vi.fn(),
  getAntigravityQuota: vi.fn(),
}));
const online: AntigravityQuotaResponse = { ok: true, models: [] };
const offline: AntigravityQuotaResponse = { ok: false, models: [], error: 'offline' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(api.inTauri).mockReturnValue(true);
  vi.mocked(api.getAntigravityPort).mockResolvedValue(null);
  vi.mocked(api.getAntigravityQuota).mockResolvedValue(online);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });
const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(120_000);
  });

it('automatically loads and refreshes when no manual port is configured', async () => {
  const { result } = renderHook(() => useAntigravityQuota(null));
  await flush();
  expect(result.current.quota).toEqual(online);
  await act(() => result.current.load(true));
  await tick();
  expect(api.getAntigravityQuota).toHaveBeenCalledTimes(3);
  expect(result.current.refreshing).toBe(false);
});

it('reloads when switching between manual and automatic port selection', async () => {
  const { result, rerender } = renderHook(({ port }) => useAntigravityQuota(port), {
    initialProps: { port: null as number | null },
  });
  await flush();
  rerender({ port: 5001 });
  await flush();
  rerender({ port: null });
  await flush();
  expect(result.current.quota).toEqual(online);
  expect(api.getAntigravityQuota).toHaveBeenCalledTimes(3);
});

it('automatically refreshes tray data while the main window is absent', async () => {
  const { result } = renderHook(() => useAntigravityQuota());
  await flush();
  await tick();
  expect(result.current.quota).toEqual(online);
  expect(api.getAntigravityQuota).toHaveBeenCalledTimes(2);
});

it('retries configured offline and rejected queries on the next normal interval', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(api.getAntigravityQuota)
    .mockResolvedValueOnce(offline)
    .mockRejectedValueOnce(new Error('unavailable'));
  const { result } = renderHook(() => useAntigravityQuota(5001));
  await flush();
  expect(result.current.quota).toEqual(offline);
  await tick();
  expect(result.current.refreshing).toBe(false);
  await tick();
  expect(result.current.quota).toEqual(online);
});

it('deduplicates requests and ignores responses from an older configuration', async () => {
  let resolve!: (value: AntigravityQuotaResponse) => void;
  vi.mocked(api.getAntigravityQuota).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result, rerender, unmount } = renderHook(({ port }) => useAntigravityQuota(port), {
    initialProps: { port: 5001 as number | null },
  });
  await act(() => result.current.load(true));
  await tick();
  expect(api.getAntigravityQuota).toHaveBeenCalledTimes(1);
  vi.mocked(api.getAntigravityQuota).mockResolvedValue(offline);
  rerender({ port: null });
  await act(async () => {
    resolve(online);
  });
  expect(result.current.quota).toEqual(offline);
  expect(result.current.refreshing).toBe(false);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps request ownership per mounted window and releases timers on unmount', async () => {
  const first = renderHook(() => useAntigravityQuota(5001));
  const second = renderHook(() => useAntigravityQuota(5001));
  await flush();
  expect(api.getAntigravityQuota).toHaveBeenCalledTimes(2);
  first.unmount();
  await tick();
  expect(api.getAntigravityQuota).toHaveBeenCalledTimes(3);
  expect(second.result.current.quota).toEqual(online);
  second.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('skips native calls in browser previews', async () => {
  vi.mocked(api.inTauri).mockReturnValue(false);
  renderHook(() => useAntigravityQuota(5001));
  await tick();
  expect(api.getAntigravityQuota).not.toHaveBeenCalled();
  expect(api.getAntigravityPort).not.toHaveBeenCalled();
});

it('waits for loaded app settings before the first native query', async () => {
  const { rerender } = renderHook(({ ready }) => useAntigravityQuota(null, ready), {
    initialProps: { ready: false },
  });
  await tick();
  expect(api.getAntigravityQuota).not.toHaveBeenCalled();
  rerender({ ready: true });
  await flush();
  expect(api.getAntigravityQuota).toHaveBeenCalledTimes(1);
});

it('receives the completed native result after a configuration change during refresh', async () => {
  let first!: (v: AntigravityQuotaResponse) => void;
  let joined!: (v: AntigravityQuotaResponse) => void;
  vi.mocked(api.getAntigravityQuota)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        first = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise((resolve) => {
        joined = resolve;
      }),
    );
  const { result, rerender } = renderHook(({ port }) => useAntigravityQuota(port), {
    initialProps: { port: 5001 as number | null },
  });
  await flush();
  rerender({ port: null });
  await flush();
  expect(result.current.quota).toBeNull();
  await act(async () => {
    first(offline);
    joined(online);
  });
  expect(result.current.quota).toEqual(online);
  expect(result.current.refreshing).toBe(false);
});

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestMonitor } from './monitor';
import * as api from '../lib/api';
import type { RequestMonitorSnapshot } from '../lib/types';

vi.mock('../lib/api', () => ({ queryRequestMonitor: vi.fn() }));
const snapshot: RequestMonitorSnapshot = {
  records: [
    {
      requestId: 'r-1',
      recordId: 'observation-1',
      startedAt: new Date().toISOString(),
      model: 'test-model',
      profileHash: 'account-hash',
      providerHash: 'provider-hash',
      status: 200,
      latencyMs: 1200,
      ttftMs: null,
      headersMs: 3,
      retryCount: 0,
      streamState: 'completed',
      outcomeCode: null,
      usage: { inputTokens: 100, outputTokens: 10, cachedInputTokens: 20 },
    },
  ],
  providerNames: { 'provider-hash': 'Test provider' },
  profileNames: { 'account-hash': 'work' },
  earliestRecordedAt: null,
  readAt: new Date().toISOString(),
  legacyRecords: 2,
  invalidRecords: 0,
  pendingLine: false,
  truncated: false,
  recordLimit: 5000,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.queryRequestMonitor).mockResolvedValue(snapshot);
});

describe('request monitor', () => {
  it('polls only while auto refresh is enabled and stops on unmount', async () => {
    vi.useFakeTimers();
    try {
      const view = render(<RequestMonitor />);
      await act(async () => {});
      expect(api.queryRequestMonitor).toHaveBeenCalledTimes(1);
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(api.queryRequestMonitor).toHaveBeenCalledTimes(2);
      fireEvent.click(screen.getByRole('checkbox', { name: /Auto/ }));
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(api.queryRequestMonitor).toHaveBeenCalledTimes(2);
      view.unmount();
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      expect(api.queryRequestMonitor).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it('states coverage and shows upstream cache without inventing first token timing', async () => {
    render(<RequestMonitor />);
    await screen.findByText('test-model', { selector: 'td' });
    expect(screen.getByText(/Official Codex.*not connected/i)).toBeTruthy();
    expect(screen.getByText(/Gateway traffic only/i)).toBeTruthy();
    expect(screen.getByText('20.0%')).toBeTruthy();
    expect(screen.getByText(/1 of 1 requests/)).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getByText('work')).toBeTruthy();
    expect(within(table).getByText('Test provider')).toBeTruthy();
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText(/2 legacy records excluded/)).toBeTruthy();
    expect(screen.queryByText(/cost|\$0\.00|total tokens/i)).toBeNull();
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'test-model' } });
    expect(within(table).getByText('test-model')).toBeTruthy();
  });

  it('keeps empty observation distinct from zero usage, and exposes refresh failures', async () => {
    vi.mocked(api.queryRequestMonitor).mockResolvedValue({ ...snapshot, records: [] });
    render(<RequestMonitor />);
    await screen.findByText('No recorded requests in this view.');
    vi.mocked(api.queryRequestMonitor).mockRejectedValue(new Error('Log unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh monitor' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('Log unavailable');
  });

  it('does not allow an older refresh to overwrite newer data', async () => {
    let resolveOld!: (value: RequestMonitorSnapshot) => void;
    vi.mocked(api.queryRequestMonitor).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    render(<RequestMonitor />);
    expect(screen.getByRole('status').textContent).toContain('Loading');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh monitor' }));
    await screen.findByText('test-model', { selector: 'td' });
    await act(async () => resolveOld({ ...snapshot, records: [] }));
    await waitFor(() => expect(screen.getByText('test-model', { selector: 'td' })).toBeTruthy());
  });
});

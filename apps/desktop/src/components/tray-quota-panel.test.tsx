import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrayQuotaPanel } from './tray-quota-panel';
import * as api from '../lib/api';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { confirm as dialogConfirm } from '@tauri-apps/plugin-dialog';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: vi.fn(() => ({
    hide: vi.fn(),
    listen: vi.fn(() => Promise.resolve(vi.fn())),
  })),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn(async () => true),
}));

vi.mock('../lib/tray-popover-size', () => ({
  scheduleTrayPopoverWindowSize: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  hideQuotaPopover: vi.fn(),
  listAccounts: vi.fn(),
  listCachedAccounts: vi.fn(),
  listCachedQuotas: vi.fn(),
  listProfileProviderBindingsV2: vi.fn(),
  listSessionsPage: vi.fn(),
  openTerminalWithCommand: vi.fn(),
  openTerminalWithResume: vi.fn(),
  relayResumeSession: vi.fn(),
  getProfileQuota: vi.fn(),
  getAuthMode: vi.fn(),
  inTauri: vi.fn(() => true),
  restartChatgpt: vi.fn(),
  setQuotaPopoverOpacity: vi.fn(),
  switchToPatAccount: vi.fn(),
  getAppTarget: vi.fn(),
  listProvidersV2: vi.fn(),
  planAttachProviderV2: vi.fn(),
  executeAttachProviderV2: vi.fn(),
  planDetachProviderV2: vi.fn(),
  executeDetachProviderV2: vi.fn(),
  getAntigravityQuota: vi.fn(),
  getAntigravityPort: vi.fn(),
}));

const account = {
  id: 'main',
  displayName: 'main',
  codexHome: '/tmp/.codex',
  wrapperPath: null,
  hasAuth: true,
  hasConfig: true,
  hasHistory: false,
  sessionCount: 1,
  latestSessionModifiedAt: 1,
  managed: false,
  isRelay: false,
  relaySource: null,
  relayIdentity: null,
  providerId: 'openai',
  model: 'gpt-5-codex',
  authMode: 'config',
};

const traySession = {
  id: 's1',
  accountId: 'main',
  path: '/tmp/session.jsonl',
  cwd: '/tmp',
  modifiedAt: 1,
  sizeBytes: 1,
  model: 'gpt-5-codex',
  summary: null,
  originalProviderId: 'openai',
  originalModel: 'gpt-5-codex',
  currentProviderId: 'openai',
  currentModel: 'gpt-5-codex',
  providerMismatch: false,
};

const cachedQuota = {
  profileId: 'main',
  source: 'app_server_rate_limits',
  fetchedAt: 1,
  staleness: 'cached',
  planType: 'team',

  primaryUsedPercent: 40,
  secondaryUsedPercent: 10,
  remainingPercent: 60,
  resetAt: '2026-06-16T10:00:00Z',
  secondaryResetAt: '2026-06-17T10:00:00Z',
  alerts: [],
  suggestedActions: [],
};

const freshQuota = {
  ...cachedQuota,
  fetchedAt: 2,
  staleness: 'fresh',
  primaryUsedPercent: 20,
  remainingPercent: 80,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setTauriInternals(enabled: boolean) {
  if (enabled) {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    return;
  }
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
}

beforeEach(() => {
  vi.clearAllMocks();
  setTauriInternals(true);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      disconnect() {}
    },
  });
  vi.mocked(api.listCachedAccounts).mockResolvedValue([account]);
  vi.mocked(api.listAccounts).mockResolvedValue([account]);
  vi.mocked(api.listCachedQuotas).mockResolvedValue([cachedQuota]);
  vi.mocked(api.listSessionsPage).mockResolvedValue({
    items: [traySession],
    nextCursor: null,
  });
  vi.mocked(api.getProfileQuota).mockResolvedValue(freshQuota);
  vi.mocked(api.listProfileProviderBindingsV2).mockResolvedValue([]);
  vi.mocked(api.getAuthMode).mockResolvedValue('oauth');
  vi.mocked(api.restartChatgpt).mockResolvedValue();
  vi.mocked(api.switchToPatAccount).mockResolvedValue();
  vi.mocked(api.getAppTarget).mockResolvedValue({
    kind: 'account',
    accountId: null,
    providerId: null,
  });
  vi.mocked(api.listProvidersV2).mockResolvedValue({ revision: 0, providers: [] });
  vi.mocked(api.getAntigravityPort).mockResolvedValue(5001);
  vi.mocked(api.getAntigravityQuota).mockResolvedValue({ ok: true, models: [] });
  vi.mocked(listen).mockResolvedValue(vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TrayQuotaPanel', () => {
  it('reads only the latest session per account for the active source', async () => {
    render(<TrayQuotaPanel />);

    await waitFor(() => expect(api.listSessionsPage).toHaveBeenCalledWith('main', { limit: 1 }));
  });

  it('does not start overlapping Antigravity auto-refresh requests', async () => {
    const pending = deferred<{ ok: boolean; models: never[] }>();
    vi.mocked(api.getAntigravityQuota).mockReturnValue(pending.promise);
    const intervals: Array<{ handler: TimerHandler; timeout?: number }> = [];
    const setIntervalSpy = vi
      .spyOn(window, 'setInterval')
      .mockImplementation((handler, timeout) => {
        intervals.push({ handler, timeout });
        return intervals.length as unknown as ReturnType<typeof window.setInterval>;
      });

    render(<TrayQuotaPanel />);

    await waitFor(() => expect(api.getAntigravityQuota).toHaveBeenCalledTimes(1));

    await act(async () => {
      for (const interval of intervals.filter((item) => item.timeout === 2 * 60_000)) {
        if (typeof interval.handler === 'function') {
          interval.handler();
        }
      }
    });
    expect(api.getAntigravityQuota).toHaveBeenCalledTimes(1);

    pending.resolve({ ok: true, models: [] });
    await Promise.resolve();
    setIntervalSpy.mockRestore();
  });

  it('uses cached quota when the main app sync event fires', async () => {
    const listeners = new Map<string, Array<() => void>>();
    vi.mocked(listen).mockImplementation((event, handler) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler as () => void]);
      return Promise.resolve(vi.fn());
    });

    const { container } = render(<TrayQuotaPanel />);
    await waitFor(() => expect(screen.getAllByText('60%').length).toBeGreaterThan(0));
    expect(screen.getByText('TEAM')).toBeTruthy();
    expect(container.querySelector('.planTypeBadge')?.textContent).toContain('TEAM');

    const cachedReads = vi.mocked(api.listCachedQuotas).mock.calls.length;
    listeners.get('quota-popover-refresh')?.forEach((handler) => handler());
    await waitFor(() =>
      expect(vi.mocked(api.listCachedQuotas).mock.calls.length).toBeGreaterThan(cachedReads),
    );

    expect(api.getProfileQuota).not.toHaveBeenCalled();
  });

  it('refreshes only the selected account from its row action', async () => {
    const { container } = render(<TrayQuotaPanel />);
    await waitFor(() => expect(screen.getAllByText('60%').length).toBeGreaterThan(0));
    expect(
      container.querySelector('.trayAccountRow')?.classList.contains('trayAccountRow--monthlyOnly'),
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh main quota' }));

    await waitFor(() => expect(api.getProfileQuota).toHaveBeenCalledWith('main', true));
    expect(api.getProfileQuota).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getAllByText('80%').length).toBeGreaterThan(0));
  });

  it('shows only the monthly window for monthly-only quota accounts', async () => {
    vi.mocked(api.listCachedQuotas).mockResolvedValue([
      {
        ...cachedQuota,
        primaryUsedPercent: 11,
        primaryWindowDurationMins: 43800,
        secondaryUsedPercent: null,
        secondaryWindowDurationMins: null,
        remainingPercent: 89,
        resetAt: '1784724636',
        secondaryResetAt: null,
      },
    ]);

    const { container } = render(<TrayQuotaPanel />);

    await waitFor(() => expect(screen.getByText('monthly')).toBeTruthy());
    expect(
      container.querySelector('.trayAccountRow')?.classList.contains('trayAccountRow--monthlyOnly'),
    ).toBe(true);
    expect(screen.getAllByText('89%').length).toBeGreaterThan(0);
    expect(screen.queryByText('weekly')).toBeNull();
    expect(screen.queryByText('5h')).toBeNull();
  });

  it('shows PAT switch actions in PAT mode', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    vi.mocked(api.listAccounts).mockResolvedValue([
      { ...account, id: 'main', displayName: 'main', isActiveAuth: true, authMode: 'config' },
      {
        ...account,
        id: 'codex-pat',
        displayName: 'codex-pat',
        isActiveAuth: false,
        authMode: 'personal_token',
      },
    ]);
    vi.mocked(api.listCachedAccounts).mockResolvedValue([]);
    vi.mocked(api.listCachedQuotas).mockResolvedValue([]);

    render(<TrayQuotaPanel />);

    await waitFor(() => expect(screen.getByText('codex-pat')).toBeTruthy());
    expect(screen.getAllByText('PAT').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));

    await waitFor(() => expect(api.switchToPatAccount).toHaveBeenCalledWith('codex-pat'));
    await waitFor(() => expect(api.getProfileQuota).toHaveBeenCalledWith('main', true));
    await waitFor(() => expect(api.restartChatgpt).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.switchToPatAccount).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.restartChatgpt).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(api.getProfileQuota).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.restartChatgpt).mock.invocationCallOrder[0],
    );
    expect(api.relayResumeSession).not.toHaveBeenCalled();
  });

  it('offers PAT switching only to accounts that can take over the Codex App', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    vi.mocked(api.listAccounts).mockResolvedValue([
      { ...account, id: 'main', displayName: 'main' },
      { ...account, id: 'logged-out', displayName: 'logged-out', hasAuth: false },
      { ...account, id: 'key', displayName: 'key', authMode: 'api_key' },
      { ...account, id: 'pro', displayName: 'pro' },
      { ...account, id: 'work', displayName: 'work', authMode: 'oauth' },
    ]);
    vi.mocked(api.listProfileProviderBindingsV2).mockResolvedValue([
      {
        profileId: 'pro',
        providerId: 'account-pro',
        selectedModel: 'gpt-5',
        routeKind: 'direct',
        revision: 1,
        providerRevision: 1,
      },
    ]);
    vi.mocked(api.listCachedAccounts).mockResolvedValue([]);
    vi.mocked(api.listCachedQuotas).mockResolvedValue([]);

    render(<TrayQuotaPanel />);
    await waitFor(() => expect(screen.getByText('work')).toBeTruthy());
    const switchIn = (name: string) =>
      within(screen.getByRole('article', { name: `${name} account` })).getByRole('button', {
        name: 'Switch',
      });

    await waitFor(() =>
      expect(
        within(screen.getByRole('article', { name: 'pro account' })).getByRole('button', {
          name: 'Use in Codex App',
        }),
      ).toBeTruthy(),
    );
    const blocked: Array<[string, RegExp]> = [
      ['main', /main profile/i],
      ['logged-out', /log in/i],
      ['key', /api key/i],
    ];
    for (const [name, reason] of blocked) {
      expect(switchIn(name)).toHaveProperty('disabled', true);
      expect(switchIn(name).getAttribute('title')).toMatch(reason);
    }
    expect(switchIn('work')).toHaveProperty('disabled', false);

    fireEvent.click(switchIn('work'));
    await waitFor(() =>
      expect(screen.getByText('Codex App now uses work. Restarting ChatGPT…')).toBeTruthy(),
    );
  });

  describe('Codex App target in PAT mode', () => {
    beforeEach(() => {
      vi.mocked(api.getAuthMode).mockResolvedValue('pat');
      vi.mocked(api.listAccounts).mockResolvedValue([
        { ...account, id: 'main', displayName: 'main' },
        { ...account, id: 'pro', displayName: 'pro' },
        { ...account, id: 'work', displayName: 'work', authMode: 'oauth' },
      ]);
      vi.mocked(api.listProfileProviderBindingsV2).mockResolvedValue([
        {
          profileId: 'pro',
          providerId: 'account-pro',
          selectedModel: 'gpt-5',
          routeKind: 'direct',
          revision: 1,
          providerRevision: 1,
        },
      ]);
      vi.mocked(api.listProvidersV2).mockResolvedValue({
        revision: 1,
        providers: [{ id: 'account-pro', name: 'pro API connection' }],
      } as never);
      vi.mocked(api.listCachedAccounts).mockResolvedValue([]);
      vi.mocked(api.listCachedQuotas).mockResolvedValue([]);
      vi.mocked(api.planDetachProviderV2).mockResolvedValue({
        planId: 'detach-1',
        fingerprint: 'fp-d',
      } as never);
      vi.mocked(api.executeDetachProviderV2).mockResolvedValue({} as never);
      vi.mocked(api.planAttachProviderV2).mockResolvedValue({
        planId: 'attach-1',
        fingerprint: 'fp-a',
        blockers: [],
      } as never);
      vi.mocked(api.executeAttachProviderV2).mockResolvedValue({} as never);
      vi.mocked(dialogConfirm).mockResolvedValue(true);
    });

    const rowButton = (row: string, name: string) =>
      within(screen.getByRole('article', { name: `${row} account` })).getByRole('button', {
        name,
      });

    it('shows the connection and detaches it before switching accounts', async () => {
      vi.mocked(api.getAppTarget).mockResolvedValue({
        kind: 'provider',
        accountId: null,
        providerId: 'account-pro',
      });

      render(<TrayQuotaPanel />);
      await waitFor(() =>
        expect(screen.getByLabelText('Codex App target').textContent).toBe(
          'Codex App: pro API connection (External API)',
        ),
      );
      expect(rowButton('pro', 'Use in Codex App')).toHaveProperty('disabled', true);

      fireEvent.click(rowButton('work', 'Switch'));

      await waitFor(() => expect(api.restartChatgpt).toHaveBeenCalledTimes(1));
      expect(api.planDetachProviderV2).toHaveBeenCalledWith('main');
      expect(api.switchToPatAccount).toHaveBeenCalledWith('work');
      expect(vi.mocked(api.executeDetachProviderV2).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(api.switchToPatAccount).mock.invocationCallOrder[0],
      );
    });

    it('lets an External API account take over the Codex App', async () => {
      vi.mocked(api.getAppTarget).mockResolvedValue({
        kind: 'account',
        accountId: 'work',
        providerId: null,
      });

      render(<TrayQuotaPanel />);
      await waitFor(() =>
        expect(screen.getByLabelText('Codex App target').textContent).toBe('Codex App: work'),
      );

      fireEvent.click(rowButton('pro', 'Use in Codex App'));

      await waitFor(() => expect(api.restartChatgpt).toHaveBeenCalledTimes(1));
      expect(api.planAttachProviderV2).toHaveBeenCalledWith({
        profileId: 'main',
        providerId: 'account-pro',
        selectedModel: 'gpt-5',
      });
      expect(
        screen.getByText('Codex App now uses pro API connection. Restarting ChatGPT…'),
      ).toBeTruthy();
    });
  });

  it('renders API-key-like Codex auth as generic Auth in tray rows', async () => {
    vi.mocked(api.listCachedAccounts).mockResolvedValue([{ ...account, authMode: 'api_key' }]);
    vi.mocked(api.listAccounts).mockResolvedValue([{ ...account, authMode: 'api_key' }]);

    render(<TrayQuotaPanel />);

    await waitFor(() => expect(screen.getAllByText('Auth').length).toBeGreaterThan(0));
    expect(screen.queryByText('API Key')).toBeNull();
  });

  it('marks External API accounts and skips their quota sync', async () => {
    const apiAccount = { ...account, id: 'api-1', displayName: 'api-1', authMode: 'config' };
    vi.mocked(api.listCachedAccounts).mockResolvedValue([account, apiAccount]);
    vi.mocked(api.listAccounts).mockResolvedValue([account, apiAccount]);
    vi.mocked(api.listCachedQuotas).mockResolvedValue([cachedQuota]);
    vi.mocked(api.listProfileProviderBindingsV2).mockResolvedValue([
      {
        profileId: 'api-1',
        providerId: 'account-api-1',
        selectedModel: 'gpt-5',
        routeKind: 'gateway',
        revision: 1,
        providerRevision: 1,
      },
    ]);

    render(<TrayQuotaPanel />);

    await waitFor(() => expect(screen.getByText('api-1')).toBeTruthy());
    expect(screen.getByText('External API')).toBeTruthy();
    expect(screen.getByText('External API · no quota tracking')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Refresh api-1 quota' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh quotas' }));

    await waitFor(() => expect(api.getProfileQuota).toHaveBeenCalledWith('main', true));
    expect(api.getProfileQuota).not.toHaveBeenCalledWith('api-1', true);
  });

  it('shows Antigravity model rows with weekly and five-hour quota windows', async () => {
    vi.mocked(api.getAntigravityQuota).mockResolvedValue({
      ok: true,
      models: [
        { label: 'Gemini Flash', remainingFraction: 0.91 },
        { label: 'Claude Sonnet', remainingFraction: 0.66 },
      ],
      groups: [
        {
          displayName: 'Gemini Models',
          description: 'Models within this group: Gemini Flash, Gemini Pro',
          buckets: [
            {
              bucketId: 'gemini-weekly',
              displayName: 'Weekly Limit',
              window: 'weekly',
              remainingFraction: 0.91,
              resetTime: '2026-07-07T01:21:15Z',
            },
            {
              bucketId: 'gemini-5h',
              displayName: '5h',
              window: '5h',
              remainingFraction: 0.73,
              resetTime: '2026-07-03T07:06:36Z',
            },
          ],
        },
        {
          displayName: 'Claude and GPT models',
          description: 'Models within this group: Claude Opus, Claude Sonnet, GPT-OSS',
          buckets: [
            {
              bucketId: '3p-weekly',
              displayName: 'Weekly Limit',
              window: 'weekly',
              remainingFraction: 0.66,
              resetTime: '2026-07-06T05:08:03Z',
            },
            {
              bucketId: '3p-5h',
              displayName: '5h',
              window: '5h',
              remainingFraction: 1,
              resetTime: '2026-07-03T11:11:26Z',
            },
          ],
        },
      ],
    });

    render(<TrayQuotaPanel />);

    fireEvent.click(await screen.findByRole('tab', { name: /antigravity/i }));

    await waitFor(() => expect(screen.getByText('Gemini Flash')).toBeTruthy());
    expect(screen.getByText('Claude Sonnet')).toBeTruthy();
    expect(screen.getAllByText('Weekly Limit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5h').length).toBeGreaterThan(0);
  });

  it('keeps Quit and Open without the retired local Stats action', async () => {
    render(<TrayQuotaPanel />);
    await waitFor(() => expect(screen.getAllByText('60%').length).toBeGreaterThan(0));

    const buttons = screen
      .getAllByRole('button')
      .filter((button) => ['Quit', 'Stats', 'Open'].includes(button.textContent ?? ''));
    expect(buttons.map((button) => button.textContent)).toEqual(['Quit', 'Open']);

    expect(screen.queryByRole('button', { name: /stats/i })).toBeNull();
    expect(api.restartChatgpt).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalledWith('quit_app');
  });
});

it('shows the current application version and identifies the active account card', async () => {
  render(<TrayQuotaPanel />);
  expect(await screen.findByText('v0.4.4')).toBeTruthy();
  const card = await screen.findByRole('article', { name: 'main account' });
  expect(card.getAttribute('data-active')).toBe('true');
  expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
});

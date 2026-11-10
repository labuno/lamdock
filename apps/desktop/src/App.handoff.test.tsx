import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import * as api from './lib/api';
import { useAccountStore } from './stores/accounts';
import { useAppStore } from './stores/app';
import { useProviderStore } from './stores/providers';
import { useQuotaStore } from './stores/quota';
import { useSessionStore } from './stores/sessions';
import type {
  CodexAccount,
  CodexSession,
  ProfileProviderBindingViewV2,
  ProviderProfileViewV2,
  ProfileAttachPlanViewV2,
  SessionPage,
} from './lib/types';

const sessionItems = vi.fn<(accountId: string) => Promise<CodexSession[]>>();

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(vi.fn())),
}));

vi.mock('./lib/api', () => ({
  inTauri: vi.fn(() => true),
  listCachedAccounts: vi.fn(),
  healthCheck: vi.fn(),
  listAccounts: vi.fn(),
  planCreateAccount: vi.fn(),
  listProvidersV2: vi.fn(),
  listProfileProviderBindingsV2: vi.fn(),
  getApiAccountConnectionV2: vi.fn(),
  updateApiAccountConnectionV2: vi.fn(),
  updateProviderV2: vi.fn(),
  planApiAccountModelSwitchV2: vi.fn(),
  refreshProviderModelsV2: vi.fn(),
  listSessionsPage: vi.fn(),
  querySessionsPage: vi.fn(),
  getSessionStorageSummary: vi.fn(),
  deleteSessions: vi.fn(),
  getProfileQuota: vi.fn(),
  resetProfileQuota: vi.fn(),
  listCachedQuotas: vi.fn(),
  queryRequestMonitor: vi.fn(),
  syncTrayQuota: vi.fn(),
  relayResumeSession: vi.fn(),
  openTerminalWithCommand: vi.fn(),
  openTerminalForLogin: vi.fn(),
  buildLoginCommand: vi.fn(),
  switchToPatAccount: vi.fn(),
  restartChatgpt: vi.fn(),
  exportCpaCredentials: vi.fn(),
  updatePatSessionAuth: vi.fn(),
  addPatAccount: vi.fn(),
  addSessionProfileAccount: vi.fn(),
  deleteAccount: vi.fn(),
  setAuthMode: vi.fn(),
  getAuthMode: vi.fn(() => Promise.resolve('oauth')),
  getHideDockIcon: vi.fn(() => Promise.resolve(false)),
  setHideDockIcon: vi.fn(),
  getGatewayFirstResponseTimeoutSeconds: vi.fn(() => Promise.resolve(60)),
  setGatewayFirstResponseTimeoutSeconds: vi.fn(),
  getGatewayRequestTimeoutSeconds: vi.fn(() => Promise.resolve(20 * 60)),
  setGatewayRequestTimeoutSeconds: vi.fn(),
  getAntigravityPort: vi.fn(() => Promise.resolve(null)),
  setAntigravityPort: vi.fn(),
  listTerminalTargets: vi.fn(() =>
    Promise.resolve([
      { id: 'terminal', displayName: 'Terminal.app', kind: 'terminal', installed: true },
      { id: 'ghostty', displayName: 'Ghostty', kind: 'terminal', installed: true },
    ]),
  ),
  getSelectedTerminalTarget: vi.fn(() => Promise.resolve('terminal')),
  setSelectedTerminalTarget: vi.fn(),
  getCodexLaunchPermissionPreset: vi.fn(() => Promise.resolve('askForApproval')),
  setCodexLaunchPermissionPreset: vi.fn(),
  getAntigravityQuota: vi.fn(() => Promise.resolve({ ok: true, models: [] })),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const accounts: CodexAccount[] = [
  {
    id: 'main',
    displayName: 'main',
    codexHome: '/tmp/.codex',
    wrapperPath: null,
    hasAuth: true,
    hasConfig: true,
    hasHistory: false,
    sessionCount: 1,
    latestSessionModifiedAt: 10,
    managed: false,
    isRelay: false,
    relaySource: null,
    relayIdentity: null,
    providerId: 'openai',
    model: 'gpt-5',
    authMode: 'config',
  },
  {
    id: 'codex-luna002',
    displayName: 'codex-luna002',
    codexHome: '/tmp/.codex-luna002',
    wrapperPath: null,
    hasAuth: true,
    hasConfig: true,
    hasHistory: false,
    sessionCount: 1,
    latestSessionModifiedAt: 30,
    managed: false,
    isRelay: false,
    relaySource: null,
    relayIdentity: null,
    providerId: 'openai',
    model: 'gpt-5',
    authMode: 'config',
  },
  {
    id: 'codex-c',
    displayName: 'codex-c',
    codexHome: '/tmp/.codex-c',
    wrapperPath: null,
    hasAuth: true,
    hasConfig: true,
    hasHistory: false,
    sessionCount: 1,
    latestSessionModifiedAt: 20,
    managed: false,
    isRelay: false,
    relaySource: null,
    relayIdentity: null,
    providerId: 'openai',
    model: 'gpt-5',
    authMode: 'config',
  },
];

const externalApiProvider: ProviderProfileViewV2 = {
  id: 'account-codex-c',
  name: 'codex-c API',
  protocol: 'responses',
  baseUrl: 'https://api.example.test/v1',
  defaultModel: 'gpt-5',
  models: [{ id: 'gpt-5', label: 'GPT-5' }],
  upstreamAuth: {
    kind: 'bearer',
    credential: { kind: 'codex_profile', profileId: 'codex-c' },
  },
  adapter: { kind: 'none' },
  codex: {
    streamIdleTimeoutMs: 300_000,
    directRequestMaxRetries: 0,
    directStreamMaxRetries: 0,
    queryParams: {},
    envHttpHeaders: {},
  },
  storeRevision: 4,
  usedBy: ['codex-c'],
  readinessBlockers: [],
};

const externalApiBinding: ProfileProviderBindingViewV2 = {
  profileId: 'codex-c',
  providerId: 'account-codex-c',
  selectedModel: 'gpt-5',
  routeKind: 'direct',
  revision: 1,
  providerRevision: 4,
};

function session(accountId: string, id: string, modifiedAt: number): CodexSession {
  return {
    id,
    accountId,
    path: `/tmp/${accountId}/${id}.jsonl`,
    modifiedAt,
    sizeBytes: 1,
    cwd: `/repo/${accountId}`,
    threadName: `${id} thread name`,
    summary: null,
    model: 'gpt-5',
    currentProviderId: 'openai',
    currentModel: 'gpt-5',
    providerMismatch: false,
  };
}

function sessionPage(
  items: CodexSession[],
  nextCursor: SessionPage['nextCursor'] = null,
): SessionPage {
  return { items, nextCursor };
}

function configureModelSwitch(provider: ProviderProfileViewV2) {
  vi.mocked(api.listProvidersV2).mockResolvedValue({ revision: 4, providers: [provider] });
  vi.mocked(api.listProfileProviderBindingsV2).mockResolvedValue([externalApiBinding]);
  vi.mocked(api.listAccounts).mockResolvedValue(
    accounts.map((account) =>
      account.id === 'codex-c' ? { ...account, providerId: provider.id } : account,
    ),
  );
}

async function openModelSwitch() {
  const card = (await screen.findByText('codex-c')).closest('article')!;
  fireEvent.click(await within(card).findByRole('button', { name: 'More options' }));
  fireEvent.click(await within(card).findByRole('button', { name: 'Switch model...' }));
  return screen.getByRole('combobox', { name: 'API Account model' });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  // Re-install localStorage mock destroyed by unstubAllGlobals (originally set in vitest.setup.ts)
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  useAppStore.setState({
    route: 'overview',
    status: 'Ready',
    error: '',
    appReady: false,
    modal: null,
    antigravityPort: null,
  });
  useAccountStore.setState({
    accounts: [],
    selectedAccountId: '',
    activeSession: undefined,
    divergedStrategy: 'summarize_fork_with_target_account',
    refreshing: false,
  });
  useSessionStore.setState({
    sessions: [],
    selectedSessionId: '',
    query: '',
    resume: null,
    loadedAccountId: '',
    cursor: null,
    hasMore: false,
    loading: false,
    loadGeneration: 0,
    sort: 'newest',
    ageFilter: 'all',
    managementAccountId: '',
    managementLoading: false,
    managementGeneration: 0,
    mutationRunning: false,
    storageSummary: null,
  });
  useQuotaStore.setState({
    quotas: [],
    refreshingQuotaIds: [],
    resettingQuotaIds: [],
    _timerId: null,
    _intervalId: null,
  });
  useProviderStore.setState({ providers: [], bindings: [], apiAccountConnection: null });
  vi.mocked(api.listCachedAccounts).mockResolvedValue([]);
  vi.mocked(api.getAuthMode).mockResolvedValue('oauth');
  vi.mocked(api.healthCheck).mockResolvedValue({
    ok: true,
    version: 'test',
    homeRoot: '/tmp',
  });
  vi.mocked(api.listAccounts).mockResolvedValue(accounts);
  vi.mocked(api.listSessionsPage).mockImplementation(async (accountId) =>
    sessionPage(await sessionItems(accountId)),
  );
  vi.mocked(api.querySessionsPage).mockImplementation(async (accountId) =>
    sessionPage(await sessionItems(accountId)),
  );
  vi.mocked(api.getSessionStorageSummary).mockResolvedValue({
    evaluatedAt: 0,
    activeCount: 0,
    activeBytes: 0,
    eligibleCount: 0,
    eligibleBytes: 0,
    retainedRecentCount: 20,
    minimumAgeDays: 7,
  });
  vi.mocked(api.listProvidersV2).mockResolvedValue({ revision: 0, providers: [] });
  vi.mocked(api.listProfileProviderBindingsV2).mockResolvedValue([]);
  vi.mocked(api.listCachedQuotas).mockResolvedValue([]);

  vi.mocked(api.getProfileQuota).mockResolvedValue({
    profileId: 'main',
    source: 'usage_unavailable',
    fetchedAt: 1,
    staleness: 'unavailable',
    planType: null,

    primaryUsedPercent: null,
    secondaryUsedPercent: null,
    remainingPercent: null,
    resetAt: null,
    secondaryResetAt: null,
    alerts: [],
    suggestedActions: [],
  });
  vi.mocked(api.resetProfileQuota).mockResolvedValue({
    snapshot: {
      profileId: 'main',
      source: 'app_server_rate_limits',
      fetchedAt: 2,
      staleness: 'fresh',
      planType: 'team',

      primaryUsedPercent: 3,
      secondaryUsedPercent: null,
      remainingPercent: 97,
      resetAt: null,
      secondaryResetAt: null,
      resetCreditCount: 0,
      alerts: [],
      suggestedActions: [],
    },
    outcome: 'reset',
    operationId: 'op-1',
  });
  vi.mocked(api.relayResumeSession).mockResolvedValue({
    action: 'copied',
    fromProfileId: 'main',
    toProfileId: 'codex-c',
    sessionId: 'main-session',
    sourcePath: '/tmp/main/main-session.jsonl',
    targetPath: '/tmp/codex-c/main-session.jsonl',
    resume: { command: 'codex resume main-session', sideEffects: [] },
    warnings: [],
  });
  vi.mocked(api.openTerminalWithCommand).mockResolvedValue();
  vi.mocked(api.openTerminalForLogin).mockResolvedValue();
  vi.mocked(api.switchToPatAccount).mockResolvedValue();
  vi.mocked(api.restartChatgpt).mockResolvedValue();
  vi.mocked(api.updatePatSessionAuth).mockResolvedValue();
  vi.mocked(api.exportCpaCredentials).mockResolvedValue({
    fileName: 'codex-c-cpa.json',
    content: { access_token: 'at-test' },
  });
  vi.mocked(api.addPatAccount).mockResolvedValue({
    accountId: 'codex-nova',
    email: 'nova@example.com',
    expired: '2030-12-31T23:59:59Z',
  });
  vi.mocked(api.addSessionProfileAccount).mockResolvedValue({
    profileId: 'nova',
    homePath: '/tmp/.codex-nova',
    wrapperPath: '/tmp/bin/codex-nova',
    operations: [],
    warnings: [],
  });
  vi.mocked(api.deleteAccount).mockResolvedValue({
    profileId: 'codex-c',
    removedHomePath: '/tmp/.codex-c',
    removedWrapperPath: '/tmp/bin/codex-c',
  });
  vi.mocked(api.setAuthMode).mockResolvedValue();
  vi.mocked(api.getAuthMode).mockResolvedValue('oauth');
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:lam-cpa'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('App handoff modal', () => {
  it('opens the gateway monitor from primary navigation', async () => {
    vi.mocked(api.queryRequestMonitor).mockResolvedValue({
      records: [],
      providerNames: {},
      profileNames: {},
      earliestRecordedAt: null,
      readAt: new Date().toISOString(),
      legacyRecords: 0,
      invalidRecords: 0,
      pendingLine: false,
      truncated: false,
      recordLimit: 5000,
    });
    render(<App />);
    await screen.findByText('main');
    fireEvent.click(screen.getByRole('button', { name: 'Monitor' }));
    await screen.findByRole('heading', { name: 'Request monitor' });
    expect(api.queryRequestMonitor).toHaveBeenCalled();
  });
  it('keeps official quota queries without offering unverified local Usage totals', async () => {
    render(<App />);
    await screen.findByText('main');

    expect(screen.queryByRole('button', { name: 'Usage' })).toBeNull();
    expect(api.listCachedQuotas).toHaveBeenCalled();
  });

  it('does not offer local Usage reset or estimated rate cards in Settings', async () => {
    render(<App />);
    await screen.findByText('main');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('button', { name: /rate card/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.queryByRole('button', { name: 'Reset Usage Statistics' })).toBeNull();
  });

  it.each([
    { defaultModel: 'gpt-next', expected: 'gpt-next' },
    { defaultModel: 'removed-default', expected: 'first-model' },
  ])('falls back to $expected when the account model is unavailable', async (testCase) => {
    configureModelSwitch({
      ...externalApiProvider,
      defaultModel: testCase.defaultModel,
      models: [
        { id: 'first-model', label: 'First model' },
        { id: 'gpt-next', label: 'Next model' },
      ],
    });

    render(<App />);
    const selection = await openModelSwitch();

    expect(selection).toHaveProperty('value', testCase.expected);
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await waitFor(() =>
      expect(api.planApiAccountModelSwitchV2).toHaveBeenCalledWith('codex-c', testCase.expected),
    );
  });

  it('keeps a valid account model when the provider default differs', async () => {
    configureModelSwitch({
      ...externalApiProvider,
      defaultModel: 'gpt-next',
      models: [...externalApiProvider.models, { id: 'gpt-next', label: 'Next model' }],
    });

    render(<App />);

    expect(await openModelSwitch()).toHaveProperty('value', 'gpt-5');
  });

  it('never commits an executable old preview after its model is removed', async () => {
    configureModelSwitch(externalApiProvider);
    const plan: ProfileAttachPlanViewV2 = {
      planId: 'switch-plan',
      fingerprint: 'fingerprint',
      expiresAtMs: Date.now() + 60_000,
      profileId: 'codex-c',
      providerId: externalApiProvider.id,
      selectedModel: 'gpt-5',
      routeKind: 'direct',
      blockers: [],
      warnings: [],
      operations: [],
      redactedPreview: '',
      expectedProviderStoreRevision: 4,
      expectedBindingStoreRevision: 1,
      expectedBindingRevision: 1,
      sourceConfigHash: 'config-hash',
    };
    vi.mocked(api.planApiAccountModelSwitchV2).mockResolvedValue(plan);
    const committedStates: Array<{ model: string; canSwitch: boolean }> = [];
    let observeCatalogChange = false;
    render(
      <Profiler
        id="model-switch"
        onRender={() => {
          if (!observeCatalogChange) return;
          const selection = screen.getByRole<HTMLSelectElement>('combobox', {
            name: 'API Account model',
          });
          const dialog = selection.closest('section')!;
          const execute = within(dialog).getByRole<HTMLButtonElement>('button', {
            name: 'Switch Model',
          });
          committedStates.push({ model: selection.value, canSwitch: !execute.disabled });
        }}
      >
        <App />
      </Profiler>,
    );
    const selection = await openModelSwitch();
    const dialog = within(selection.closest('section')!);
    fireEvent.click(dialog.getByRole('button', { name: 'Review' }));
    await waitFor(() =>
      expect(dialog.getByRole('button', { name: 'Switch Model' })).toHaveProperty(
        'disabled',
        false,
      ),
    );

    observeCatalogChange = true;
    act(() => {
      useProviderStore.setState({
        providers: [
          {
            ...externalApiProvider,
            defaultModel: 'gpt-next',
            models: [{ id: 'gpt-next', label: 'Next model' }],
          },
        ],
      });
    });

    expect(committedStates.length).toBeGreaterThan(0);
    expect(committedStates.every((state) => state.model === 'gpt-next' && !state.canSwitch)).toBe(
      true,
    );
    expect(dialog.queryByText('New default model')).toBeNull();
  });

  it('loads handoff sessions in pages and appends older sessions on demand', async () => {
    const firstPage = [1, 2, 3, 4, 5].map((index) => session('main', `main-${index}`, index));
    const secondPage = [session('main', 'main-6', 0)];
    const pageCalls: Array<{ accountId: string; cursor: SessionPage['nextCursor'] }> = [];
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.listSessionsPage).mockImplementation(async (accountId, request) => {
      if (request?.limit !== 5) return sessionPage([]);
      pageCalls.push({ accountId, cursor: request?.cursor ?? null });
      return request?.cursor
        ? sessionPage(secondPage)
        : sessionPage(firstPage, { modifiedAt: 1, path: '/tmp/main/main-1.jsonl' });
    });

    render(<App />);
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: 'Handoff' }));
    await screen.findByText(/main-1 thread name/);
    const sessionSelect = screen.getByLabelText('Session') as HTMLSelectElement;
    expect(sessionSelect).toHaveProperty('options.length', 5);
    expect(sessionSelect.options[0]?.textContent).toBe('main-5 · main-5 thread name · /repo/main');
    expect(screen.getByRole('button', { name: /load earlier sessions/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /load earlier sessions/i }));
    await screen.findByText(/main-6 thread name/);

    expect(screen.getByLabelText('Session')).toHaveProperty('options.length', 6);
    expect(pageCalls).toEqual([
      { accountId: 'main', cursor: null },
      { accountId: 'main', cursor: { modifiedAt: 1, path: '/tmp/main/main-1.jsonl' } },
    ]);
  });

  it.each(['success', 'failure'])(
    'ignores stale pagination %s after switching sources',
    async (outcome) => {
      const oldPage = deferred<SessionPage>();
      const newPage = deferred<SessionPage>();
      const oldCursor = { modifiedAt: 1, path: '/tmp/main/first.jsonl' };
      const newCursor = { modifiedAt: 2, path: '/tmp/codex-luna002/first.jsonl' };
      vi.mocked(api.listSessionsPage).mockImplementation((accountId, request) => {
        if (request?.limit !== 5) return Promise.resolve(sessionPage([]));
        if (accountId === 'main') {
          if (!request.cursor)
            return Promise.resolve(sessionPage([session('main', 'old-first', 3)], oldCursor));
          return oldPage.promise.then((page) => {
            if (outcome === 'failure') throw new Error('stale page error');
            return page;
          });
        }
        if (!request?.cursor) return newPage.promise;
        return Promise.resolve(sessionPage([session(accountId, 'new-older', 1)]));
      });
      render(<App />);
      const card = (await screen.findByText('codex-c')).closest('article')!;
      fireEvent.click(within(card).getByRole('button', { name: 'Handoff' }));
      await screen.findByRole('option', { name: /old-first thread name/ });
      fireEvent.click(screen.getByRole('button', { name: /load earlier sessions/i }));
      fireEvent.change(screen.getByLabelText('Source account'), {
        target: { value: 'codex-luna002' },
      });
      await waitFor(() =>
        expect(api.listSessionsPage).toHaveBeenCalledWith('codex-luna002', { limit: 5 }),
      );

      await act(async () => oldPage.resolve(sessionPage([session('main', 'stale-older', 0)])));
      expect(screen.queryByText(/stale-older thread name/)).toBeNull();
      expect(screen.getByLabelText('Session')).toHaveProperty('disabled', true);
      expect(useAppStore.getState().error).not.toContain('stale page error');

      await act(async () =>
        newPage.resolve(sessionPage([session('codex-luna002', 'new-first', 2)], newCursor)),
      );
      expect(screen.getByLabelText('Session')).toHaveProperty('options.length', 1);
      fireEvent.click(screen.getByRole('button', { name: /load earlier sessions/i }));
      await screen.findByText(/new-older thread name/);
      expect(api.listSessionsPage).toHaveBeenCalledWith('codex-luna002', {
        limit: 5,
        cursor: newCursor,
      });
    },
  );

  it('ignores an old next page after closing and reopening the same source', async () => {
    const oldPage = deferred<SessionPage>();
    const reopenedPage = deferred<SessionPage>();
    let firstPageCalls = 0;
    vi.mocked(api.listSessionsPage).mockImplementation((accountId, request) => {
      if (request?.limit !== 5) return Promise.resolve(sessionPage([]));
      if (request.cursor) return oldPage.promise;
      firstPageCalls += 1;
      return firstPageCalls === 1
        ? Promise.resolve(
            sessionPage([session(accountId, 'original', 2)], {
              modifiedAt: 2,
              path: '/tmp/original.jsonl',
            }),
          )
        : reopenedPage.promise;
    });
    render(<App />);
    const card = (await screen.findByText('codex-c')).closest('article')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Handoff' }));
    await screen.findByRole('option', { name: /original thread name/ });
    fireEvent.click(screen.getByRole('button', { name: /load earlier sessions/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Handoff' }));
    await waitFor(() => expect(firstPageCalls).toBe(2));
    await act(async () => oldPage.resolve(sessionPage([session('main', 'stale-older', 0)])));
    expect(screen.queryByText(/stale-older thread name/)).toBeNull();
    expect(screen.getByLabelText('Session')).toHaveProperty('disabled', true);
    await act(async () => reopenedPage.resolve(sessionPage([session('main', 'reopened', 3)])));
    expect(screen.getByLabelText('Session')).toHaveProperty('options.length', 1);
  });

  it('shows a readable error when loading handoff sessions fails', async () => {
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.listSessionsPage).mockRejectedValue({
      code: 'IO_ERROR',
      message: 'Could not read the main session page',
      recoverable: true,
    });

    render(<App />);
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: 'Handoff' }));

    await waitFor(() =>
      expect(screen.getByText('Could not read the main session page')).toBeTruthy(),
    );
    expect(screen.queryByText('[object Object]')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Handoff Session' })).toBeTruthy();
  });

  it('does not start overlapping Antigravity auto-refresh requests', async () => {
    const pending = deferred<{ ok: boolean; models: never[] }>();
    vi.mocked(api.getAntigravityPort).mockResolvedValue(5001);
    vi.mocked(api.getAntigravityQuota).mockReturnValue(pending.promise);
    sessionItems.mockResolvedValue([]);
    const intervals: Array<{ handler: TimerHandler; timeout?: number }> = [];
    const setIntervalSpy = vi
      .spyOn(window, 'setInterval')
      .mockImplementation((handler, timeout) => {
        intervals.push({ handler, timeout });
        return intervals.length as unknown as ReturnType<typeof window.setInterval>;
      });

    render(<App />);

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

  it('opens the complete External API account flow from Providers', async () => {
    sessionItems.mockResolvedValue([]);
    render(<App />);
    await screen.findByText('main');

    fireEvent.click(
      within(screen.getByRole('navigation', { name: /primary/i })).getByRole('button', {
        name: /providers/i,
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Add External API' }));

    const externalApiHeading = screen.getByRole('heading', { name: 'Add Account' });
    expect(externalApiHeading).toBeTruthy();
    expect(externalApiHeading.closest('section')?.classList.contains('modalWide')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Profile Account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'PAT Account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'API Account' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Review API Account' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Add Provider' })).toBeNull();
  });

  it('opens the complete External API account flow from the global header', async () => {
    sessionItems.mockResolvedValue([]);
    render(<App />);
    await screen.findByText('main');

    expect(screen.queryByRole('button', { name: 'New Provider' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Account' }));
    fireEvent.click(screen.getByRole('button', { name: 'External API' }));

    expect(screen.getByRole('heading', { name: 'Add Account' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Profile Account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'PAT Account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'API Account' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Review API Account' })).toBeTruthy();
  });

  it('opens and updates API configuration from the account-card View&Edit action', async () => {
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.listProvidersV2).mockResolvedValue({
      revision: 4,
      providers: [externalApiProvider],
    });
    vi.mocked(api.listProfileProviderBindingsV2).mockResolvedValue([externalApiBinding]);
    vi.mocked(api.getApiAccountConnectionV2).mockResolvedValue({
      profileId: 'codex-c',
      providerId: 'account-codex-c',
      protocol: 'responses',
      baseUrl: 'https://api.example.test/v1',
      selectedModel: 'gpt-5',
      providerStoreRevision: 4,
      apiKeyConfigured: true,
      models: externalApiProvider.models,
    });
    vi.mocked(api.updateApiAccountConnectionV2).mockResolvedValue({
      profileId: 'codex-c',
      providerId: 'account-codex-c',
      protocol: 'responses',
      baseUrl: 'https://new.example.test/v1',
      selectedModel: 'gpt-5',
      providerStoreRevision: 5,
      apiKeyConfigured: true,
      models: externalApiProvider.models,
    });

    render(<App />);
    const card = (await screen.findByText('codex-c')).closest('article');
    fireEvent.click(await within(card!).findByRole('button', { name: 'More options' }));
    fireEvent.click(
      await within(card!).findByRole('button', {
        name: 'View&Edit',
      }),
    );

    await waitFor(() => expect(api.getApiAccountConnectionV2).toHaveBeenCalledWith('codex-c'));
    expect(screen.getByRole('heading', { name: 'API Account Configuration' })).toBeTruthy();
    expect(await screen.findByDisplayValue('https://api.example.test/v1')).toBeTruthy();
    expect(screen.getByText('Responses')).toBeTruthy();
    expect(screen.getByText('API key configured')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Base URL'), {
      target: { value: 'https://new.example.test/v1/' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save API account' }));

    await waitFor(() =>
      expect(api.updateApiAccountConnectionV2).toHaveBeenCalledWith({
        profileId: 'codex-c',
        expectedProviderStoreRevision: 4,
        baseUrl: 'https://new.example.test/v1',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'API Account Configuration' })).toBeNull(),
    );
  });

  it('offers the two English account types before showing a creation form', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Account' }));
    expect(screen.getByRole('heading', { name: 'Add Account' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Codex Account' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'External API' })).toBeTruthy();
    expect(screen.queryByLabelText(/account name/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'External API' }));
    expect(screen.getByRole('button', { name: 'Review API Account' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choose account type' }));
    fireEvent.click(screen.getByRole('button', { name: 'Codex Account' }));
    expect(screen.getByRole('button', { name: 'Profile Account' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PAT Account' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Account' }));
    expect(screen.getByRole('button', { name: 'Codex Account' })).toBeTruthy();
    expect(screen.queryByLabelText(/account name/i)).toBeNull();
  });

  it('uses auth.json copy switching for every account in PAT mode', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.listAccounts).mockImplementation(async () =>
      accounts.map((account) => ({
        ...account,
        isActiveAuth:
          account.id === 'codex-c' && vi.mocked(api.switchToPatAccount).mock.calls.length > 0,
      })),
    );

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText(/pat mode/i)).toHaveProperty('checked', true));
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: /switch to this account/i }));

    await waitFor(() => expect(api.switchToPatAccount).toHaveBeenCalledWith('codex-c'));
    await waitFor(() =>
      expect(
        within(accountCard!).getByRole('button', { name: /reset codex-c quota/i }),
      ).toBeTruthy(),
    );
    expect(api.openTerminalForLogin).not.toHaveBeenCalled();
  });

  it('refreshes main quota after PAT switch copies auth into main', async () => {
    const refreshAccountQuota = vi.fn();
    useQuotaStore.setState({ refreshAccountQuota });
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText(/pat mode/i)).toHaveProperty('checked', true));
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: /switch to this account/i }));

    await waitFor(() => expect(api.switchToPatAccount).toHaveBeenCalledWith('codex-c'));
    await waitFor(() => expect(refreshAccountQuota).toHaveBeenCalledWith('main'));
    await waitFor(() => expect(api.restartChatgpt).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.switchToPatAccount).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.restartChatgpt).mock.invocationCallOrder[0],
    );
    expect(refreshAccountQuota.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.restartChatgpt).mock.invocationCallOrder[0],
    );
  });

  it('refreshes the new PAT card after uploading auth.json', async () => {
    const refreshAccountQuota = vi.fn();
    useQuotaStore.setState({ refreshAccountQuota });
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /add account/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Codex Account' }));
    fireEvent.click(screen.getByRole('button', { name: /pat/i }));
    await screen.findByText(/upload auth\.json/i);
    const authFile = new File(
      [JSON.stringify({ tokens: { account_id: 'account-test-6789' } })],
      'auth.json',
      {
        type: 'application/json',
      },
    );
    Object.defineProperty(authFile, 'text', {
      value: () => Promise.resolve(JSON.stringify({ tokens: { account_id: 'account-test-6789' } })),
    });
    vi.stubGlobal(
      'FormData',
      class {
        get(name: string) {
          if (name === 'accountName') return 'nova';
          if (name === 'authFile') return authFile;
          if (name === 'personalAccessToken') return '';
          if (name === 'tokenExpiration') return '';
          return null;
        }
      },
    );

    fireEvent.submit(screen.getByRole('button', { name: /^upload$/i }).closest('form')!);

    await waitFor(() => expect(api.addPatAccount).toHaveBeenCalled());
    await waitFor(() => expect(refreshAccountQuota).toHaveBeenCalledWith('codex-nova'));
  });

  it('creates a full profile from pasted ChatGPT session JSON in Auth mode', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('oauth');
    sessionItems.mockResolvedValue([]);

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /add account/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Codex Account' }));
    fireEvent.click(screen.getByRole('button', { name: /import session/i }));

    fireEvent.change(screen.getByLabelText(/account name/i), {
      target: { value: 'nova' },
    });
    fireEvent.change(screen.getByLabelText(/session json/i), {
      target: {
        value:
          '{"accessToken":"at-new","idToken":"id-new","refreshToken":"rt-new","accountId":"account-new"}',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /import profile/i }));

    await waitFor(() =>
      expect(api.addSessionProfileAccount).toHaveBeenCalledWith({
        accountId: 'nova',
        sessionJson: {
          accessToken: 'at-new',
          idToken: 'id-new',
          refreshToken: 'rt-new',
          accountId: 'account-new',
        },
        overwriteWrapper: false,
      }),
    );
    expect(api.addPatAccount).not.toHaveBeenCalled();
  });

  it('creates a PAT token account from pasted ChatGPT session JSON', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /add account/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Codex Account' }));
    fireEvent.click(screen.getByRole('button', { name: /pat/i }));
    fireEvent.click(screen.getByRole('button', { name: /token & session/i }));
    const patInput = screen.getByPlaceholderText(/enter token/i);
    fireEvent.change(patInput, { target: { value: 'pat-new' } });
    fireEvent.change(screen.getByLabelText(/paste session json/i), {
      target: { value: '{"accessToken":"at-new","idToken":"id-new"}' },
    });
    vi.stubGlobal(
      'FormData',
      class {
        get(name: string) {
          if (name === 'accountName') return 'nova';
          if (name === 'personalAccessToken') return 'pat-new';
          if (name === 'tokenExpiration') return '';
          return null;
        }
      },
    );

    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form')!);

    await waitFor(() =>
      expect(api.addPatAccount).toHaveBeenCalledWith({
        accountId: 'nova',
        authJson: { accessToken: 'at-new', idToken: 'id-new' },
        personalAccessToken: 'pat-new',
        tokenExpiration: null,
      }),
    );
  });

  it('uses codex login for the Login button in PAT mode', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText(/pat mode/i)).toHaveProperty('checked', true));
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: /^login$/i }));

    await waitFor(() => expect(api.openTerminalForLogin).toHaveBeenCalledWith('codex-c'));
    expect(api.switchToPatAccount).not.toHaveBeenCalled();
  });

  it('exports CPA auth from the PAT mode account action', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    useQuotaStore.setState({
      quotas: [
        {
          profileId: 'codex-c',
          source: 'app_server_rate_limits',
          fetchedAt: 1,
          staleness: 'fresh',
          planType: 'team',

          primaryUsedPercent: null,
          secondaryUsedPercent: null,
          remainingPercent: null,
          resetAt: null,
          secondaryResetAt: null,
          alerts: [],
          suggestedActions: [],
        },
      ],
    });
    vi.mocked(api.exportCpaCredentials).mockResolvedValue({
      fileName: 'codex-c-cpa.json',
      content: {
        access_token: 'at-test',
        id_token:
          'header.eyJodHRwczovL2FwaS5vcGVuYWkuY29tL2F1dGgiOnsiY2hhdGdwdF9wbGFuX3R5cGUiOiJlbnRlcnByaXNlIn19.sig',
      },
    });

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText(/pat mode/i)).toHaveProperty('checked', true));
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: /more options/i }));
    fireEvent.click(screen.getByRole('button', { name: /export cpa/i }));

    await waitFor(() => expect(api.exportCpaCredentials).toHaveBeenCalledWith('codex-c'));
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    const exported = JSON.parse(await blob.text());
    expect(exported).toMatchObject({
      access_token: 'at-test',
      type: 'codex',
      websockets: true,
      plan_type: 'enterprise',
      chatgpt_plan_type: 'enterprise',
    });
    expect(exported.id_token_synthetic).toBeUndefined();
  });

  it('shows reset expiry rows in Shanghai order and confirms before reset', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.listAccounts).mockResolvedValue(
      accounts.map((account) =>
        account.id === 'codex-c' ? { ...account, isActiveAuth: true } : account,
      ),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    useQuotaStore.setState({
      quotas: [
        {
          profileId: 'codex-c',
          source: 'app_server_rate_limits',
          fetchedAt: 1,
          staleness: 'fresh',
          planType: 'team',

          primaryUsedPercent: 41,
          secondaryUsedPercent: null,
          remainingPercent: 59,
          resetAt: null,
          secondaryResetAt: null,
          resetCreditCount: 2,
          resetCreditDetails: [
            { id: 'later', expiresAt: '2026-07-12T00:00:00Z', source: 'api' },
            { id: 'soon', expiresAt: '2026-07-01T00:00:00Z', source: 'api' },
          ],
          alerts: [],
          suggestedActions: [],
        },
      ],
      resettingQuotaIds: [],
    });

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText(/pat mode/i)).toHaveProperty('checked', true));
    const accountCard = (await screen.findByRole('heading', { name: 'codex-c' })).closest(
      'article',
    );
    expect(accountCard).not.toBeNull();

    expect(within(accountCard!).queryByLabelText('Manual reset expiry')).toBeNull();
    expect(within(accountCard!).getByLabelText('Expires: 2026-07-01 08:00')).toBeTruthy();
    expect(within(accountCard!).getByLabelText('Expires: 2026-07-12 08:00')).toBeTruthy();
    expect(within(accountCard!).queryByRole('button', { name: 'Handoff' })).toBeNull();
    expect(
      within(accountCard!).getAllByRole('button', { name: /reset codex-c quota/i }),
    ).toHaveLength(1);

    fireEvent.click(within(accountCard!).getByRole('button', { name: /reset codex-c quota/i }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    await waitFor(() => expect(api.resetProfileQuota).toHaveBeenCalledWith('codex-c'));
  });

  it('uses the Login action for every account in Auth mode', async () => {
    sessionItems.mockResolvedValue([]);

    render(<App />);
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();
    expect(
      within(accountCard!).queryByRole('button', { name: /switch to this account/i }),
    ).toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: /more options/i }));
    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

    await waitFor(() => expect(api.openTerminalForLogin).toHaveBeenCalledWith('codex-c'));
    expect(api.switchToPatAccount).not.toHaveBeenCalled();
  });

  it('deletes a profile account from the Auth mode account card after confirmation', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('oauth');
    sessionItems.mockResolvedValue([]);

    render(<App />);
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: /more options/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete codex-c/i }));

    expect(await screen.findByRole('heading', { name: /delete account/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    await waitFor(() => expect(api.deleteAccount).toHaveBeenCalledWith({ profileId: 'codex-c' }));
  });

  it('does not delete a profile account when confirmation is cancelled', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('oauth');
    sessionItems.mockResolvedValue([]);

    render(<App />);
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: /more options/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete codex-c/i }));
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }));

    expect(api.deleteAccount).not.toHaveBeenCalled();
  });

  it('does not show account delete actions in PAT mode', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText(/pat mode/i)).toHaveProperty('checked', true));
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: /more options/i }));
    expect(screen.queryByRole('button', { name: /delete codex-c/i })).toBeNull();
  });

  it('uses the Login action as session auth update for PAT token accounts', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.listAccounts).mockResolvedValue(
      accounts.map((account) =>
        account.id === 'codex-c' ? { ...account, hasPersonalAccessToken: true } : account,
      ),
    );

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText(/pat mode/i)).toHaveProperty('checked', true));
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: /^update$/i }));
    const textarea = await screen.findByLabelText(/session json/i);
    fireEvent.change(textarea, {
      target: {
        value: '{"accessToken":"at-new","idToken":"id-new","user":{"email":"u@example.com"}}',
      },
    });
    const updateButtons = screen.getAllByRole('button', { name: /^update$/i });
    fireEvent.click(updateButtons[updateButtons.length - 1]);

    await waitFor(() =>
      expect(api.updatePatSessionAuth).toHaveBeenCalledWith('codex-c', {
        accessToken: 'at-new',
        idToken: 'id-new',
        user: { email: 'u@example.com' },
      }),
    );
    expect(api.openTerminalForLogin).not.toHaveBeenCalled();
  });

  it('relays the selected source session and does not fall back to latest active session', async () => {
    const mainSessions = deferred<CodexSession[]>();
    let holdMainSessions = false;
    sessionItems.mockImplementation((accountId) => {
      if (accountId === 'main') {
        if (!holdMainSessions) return Promise.resolve([session('main', 'main-initial', 10)]);
        return mainSessions.promise;
      }
      if (accountId === 'codex-luna002') {
        return Promise.resolve([session('codex-luna002', 'luna-latest', 30)]);
      }
      if (accountId === 'codex-c') return Promise.resolve([session('codex-c', 'c-session', 20)]);
      return Promise.resolve([]);
    });

    render(<App />);
    await screen.findByText('codex-c');
    await waitFor(() => expect(useAccountStore.getState().activeSession?.id).toBe('luna-latest'));
    fireEvent.click(screen.getByTitle('Choose a session to continue with codex-c'));
    await waitFor(() =>
      expect(screen.getByLabelText('Source account')).toHaveProperty('value', 'main'),
    );

    fireEvent.change(screen.getByLabelText('Source account'), {
      target: { value: 'codex-luna002' },
    });
    await screen.findAllByText(/luna-latest thread name/);

    holdMainSessions = true;
    fireEvent.change(screen.getByLabelText('Source account'), { target: { value: 'main' } });
    expect(screen.getByRole('button', { name: 'Start Handoff' })).toHaveProperty('disabled', true);

    mainSessions.resolve([session('main', 'main-session', 10)]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start Handoff' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    expect(screen.getByLabelText('Target model')).toHaveProperty('value', 'gpt-5');
    fireEvent.change(screen.getByLabelText('Target model'), { target: { value: 'chosen-model' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start Handoff' }));

    await waitFor(() =>
      expect(api.relayResumeSession).toHaveBeenCalledWith({
        fromProfileId: 'main',
        toProfileId: 'codex-c',
        sessionId: 'main-session',
        cwd: '/repo/main',
        targetModel: 'chosen-model',
        divergedStrategy: 'summarize_fork_with_target_account',
      }),
    );
    expect(api.relayResumeSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ fromProfileId: 'codex-luna002', sessionId: 'luna-latest' }),
    );
  });

  it('keeps the handoff modal open when the terminal launch fails', async () => {
    sessionItems.mockImplementation((accountId) => {
      if (accountId === 'main') return Promise.resolve([session('main', 'main-session', 10)]);
      if (accountId === 'codex-c') return Promise.resolve([session('codex-c', 'c-session', 20)]);
      return Promise.resolve([]);
    });
    vi.mocked(api.openTerminalWithCommand).mockRejectedValue(
      new Error('cmux did not accept the resume command: Broken pipe'),
    );

    render(<App />);
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: 'Handoff' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Source account')).toHaveProperty('value', 'main'),
    );
    await screen.findAllByText(/main-session thread name/);

    fireEvent.click(screen.getByRole('button', { name: 'Start Handoff' }));

    await waitFor(() =>
      expect(screen.getByText(/cmux did not accept the resume command/i)).toBeTruthy(),
    );
    expect(screen.getByRole('heading', { name: 'Handoff Session' })).toBeTruthy();
    expect(api.listAccounts).toHaveBeenCalledTimes(1);
  });

  it('closes the handoff modal after a successful terminal launch', async () => {
    sessionItems.mockImplementation((accountId) => {
      if (accountId === 'main') return Promise.resolve([session('main', 'main-session', 10)]);
      if (accountId === 'codex-c') return Promise.resolve([session('codex-c', 'c-session', 20)]);
      return Promise.resolve([]);
    });

    render(<App />);
    const accountCard = (await screen.findByText('codex-c')).closest('article');
    expect(accountCard).not.toBeNull();

    fireEvent.click(within(accountCard!).getByRole('button', { name: 'Handoff' }));
    await screen.findAllByText(/main-session thread name/);

    fireEvent.click(screen.getByRole('button', { name: 'Start Handoff' }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Handoff Session' })).toBeNull(),
    );
  });

  it('selects a terminal target from settings', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);
    useAppStore.setState({ route: 'settings' });

    render(<App />);

    const terminalSelect = (await screen.findByLabelText(/handoff terminal/i)) as HTMLSelectElement;
    expect(terminalSelect.value).toBe('terminal');

    fireEvent.change(terminalSelect, { target: { value: 'ghostty' } });

    await waitFor(() => expect(api.setSelectedTerminalTarget).toHaveBeenCalledWith('ghostty'));
  });

  it('loads and saves the Codex launch permission preset from settings', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.getCodexLaunchPermissionPreset).mockResolvedValue('askForApproval');
    useAppStore.setState({ route: 'settings' });

    render(<App />);

    const select = (await screen.findByLabelText(/codex launch permissions/i)) as HTMLSelectElement;
    expect(select.value).toBe('askForApproval');
    fireEvent.change(select, { target: { value: 'fullAccess' } });

    await waitFor(() =>
      expect(api.setCodexLaunchPermissionPreset).toHaveBeenCalledWith('fullAccess'),
    );
    expect(await screen.findByText(/bypasses approvals and sandboxing/i)).toBeTruthy();
  });

  it('loads and saves the Gateway first response timeout from settings', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.getGatewayFirstResponseTimeoutSeconds).mockResolvedValue(60);
    useAppStore.setState({ route: 'settings' });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Advanced' }));

    const input = (await screen.findByLabelText(
      /gateway first response timeout/i,
    )) as HTMLInputElement;
    expect(input.value).toBe('60');
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(api.setGatewayFirstResponseTimeoutSeconds).toHaveBeenCalledWith(120),
    );
    expect(await screen.findByLabelText(/gateway first response timeout/i)).toBeTruthy();
  });

  it('loads and saves the Gateway request timeout from settings', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.getGatewayRequestTimeoutSeconds).mockResolvedValue(1200);
    useAppStore.setState({ route: 'settings' });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Advanced' }));

    const input = (await screen.findByLabelText(/gateway request timeout/i)) as HTMLInputElement;
    expect(input.value).toBe('1200');
    fireEvent.change(input, { target: { value: '1800' } });
    fireEvent.blur(input);

    await waitFor(() => expect(api.setGatewayRequestTimeoutSeconds).toHaveBeenCalledWith(1800));
    expect(await screen.findByLabelText(/gateway request timeout/i)).toBeTruthy();
  });

  it('loads, validates, saves, and clears the Antigravity port setting', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.getAntigravityPort).mockResolvedValue(62891);
    useAppStore.setState({ route: 'settings' });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /system & desktop/i }));

    const input = (await screen.findByLabelText(/antigravity port/i)) as HTMLInputElement;
    expect(input.value).toBe('62891');
    expect(screen.getByText(/automatically detects the listening port/i)).toBeTruthy();
    expect(input.placeholder).toBe('Automatic');
    expect(screen.queryByText(/lsof/)).toBeNull();

    fireEvent.change(input, { target: { value: '63000' } });
    fireEvent.blur(input);
    await waitFor(() => expect(api.setAntigravityPort).toHaveBeenCalledWith(63000));

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    await waitFor(() => expect(api.setAntigravityPort).toHaveBeenCalledWith(null));

    vi.mocked(api.setAntigravityPort).mockClear();
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    expect(api.setAntigravityPort).not.toHaveBeenCalled();
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: '62892' } });
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    await waitFor(() => expect(api.setAntigravityPort).toHaveBeenCalledWith(62892));
    expect(api.setAntigravityPort).toHaveBeenCalledTimes(1);
  });

  it('uses Profile Only mode availability from settings', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('pat');
    sessionItems.mockResolvedValue([]);
    useAppStore.setState({ route: 'settings' });

    render(<App />);

    const availabilitySelect = (await screen.findByLabelText(
      /mode availability/i,
    )) as HTMLSelectElement;
    fireEvent.change(availabilitySelect, { target: { value: 'profile' } });

    expect(await screen.findByText('Profile Mode')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /^pat$/i })).toBeNull();
    await waitFor(() => expect(api.setAuthMode).toHaveBeenCalledWith('oauth'));

    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', {
        name: 'Overview',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /add account/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Codex Account' }));
    expect(screen.queryByRole('button', { name: /pat account/i })).toBeNull();
    expect(await screen.findByRole('button', { name: /cli auth/i })).toBeTruthy();
  });

  it('uses PAT Only mode availability from settings', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('oauth');
    sessionItems.mockResolvedValue([]);
    useAppStore.setState({ route: 'settings' });

    render(<App />);

    const availabilitySelect = (await screen.findByLabelText(
      /mode availability/i,
    )) as HTMLSelectElement;
    fireEvent.change(availabilitySelect, { target: { value: 'pat' } });

    expect(await screen.findByText('PAT Mode')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /^profile$/i })).toBeNull();
    await waitFor(() => expect(api.setAuthMode).toHaveBeenCalledWith('pat'));

    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', {
        name: 'Overview',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /add account/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Codex Account' }));
    expect(screen.queryByRole('button', { name: /profile account/i })).toBeNull();
    expect(await screen.findByText(/upload auth\.json/i)).toBeTruthy();
  });

  it('keeps both titlebar tabs in Profile & PAT mode availability', async () => {
    vi.mocked(api.getAuthMode).mockResolvedValue('oauth');
    sessionItems.mockResolvedValue([]);
    useAppStore.setState({ route: 'settings' });

    render(<App />);

    const availabilitySelect = (await screen.findByLabelText(
      /mode availability/i,
    )) as HTMLSelectElement;
    expect(availabilitySelect.value).toBe('both');
    expect(screen.getByRole('tab', { name: /^profile$/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^pat$/i })).toBeTruthy();
  });

  it('routes gateway-routed account View&Edit to the Provider editor', async () => {
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.listAccounts).mockResolvedValue([
      {
        id: 'gw',
        displayName: 'gw',
        codexHome: '/tmp/.codex-gw',
        wrapperPath: null,
        hasAuth: true,
        hasConfig: true,
        hasHistory: false,
        sessionCount: 0,
        latestSessionModifiedAt: 0,
        managed: true,
        isRelay: false,
        relaySource: null,
        relayIdentity: null,
        providerId: 'account-gw',
        model: 'deepseek/deepseek-v4-flash',
        authMode: 'config',
      },
    ]);
    const gatewayProvider: ProviderProfileViewV2 = {
      ...externalApiProvider,
      id: 'account-gw',
      name: 'gw API',
      protocol: 'chat_completions',
      upstreamAuth: {
        kind: 'bearer',
        credential: {
          kind: 'keychain',
          service: 'lam.remote-provider',
          account: 'cred/x/v1',
          version: 1,
        },
      },
      adapter: {
        kind: 'local',
        adapterId: 'responses_to_chat_completions',
        upstreamPath: '/chat/completions',
      },
    };
    vi.mocked(api.listProvidersV2).mockResolvedValue({
      revision: 4,
      providers: [gatewayProvider],
    });
    vi.mocked(api.listProfileProviderBindingsV2).mockResolvedValue([
      {
        profileId: 'gw',
        providerId: 'account-gw',
        selectedModel: 'deepseek/deepseek-v4-flash',
        routeKind: 'gateway',
        revision: 1,
        providerRevision: 4,
      },
    ]);
    vi.mocked(api.getApiAccountConnectionV2).mockRejectedValue(
      new Error('must not be called for gateway accounts'),
    );

    render(<App />);
    const card = (await screen.findByText('gw')).closest('article');
    fireEvent.click(await within(card!).findByRole('button', { name: 'More options' }));
    fireEvent.click(
      await within(card!).findByRole('button', {
        name: 'View&Edit',
      }),
    );

    // Gateway accounts open the simplified Provider editor, never the API Account editor.
    expect(screen.getByRole('heading', { name: 'Edit API Account' })).toBeTruthy();
    expect(screen.getByLabelText('API key')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fetch models' })).toBeTruthy();
    expect(api.getApiAccountConnectionV2).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'API Account Configuration' })).toBeNull();

    vi.mocked(api.refreshProviderModelsV2).mockResolvedValue({
      ...gatewayProvider,
      models: [...gatewayProvider.models, { id: 'model-new', label: 'New model' }],
    });
    vi.mocked(api.updateProviderV2).mockRejectedValue({
      code: 'STORE_REVISION_CONFLICT',
      message: 'Refresh and retry model selection',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch models' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Customize selection' }));
    fireEvent.click(screen.getByLabelText('Select model model-new'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply models' }));
    await waitFor(() => expect(api.updateProviderV2).toHaveBeenCalledOnce());
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByLabelText('Select model model-new')).toHaveProperty('checked', true);
  });
});

it('presents the workspace heading and global actions while preserving theme and navigation', async () => {
  sessionItems.mockResolvedValue([]);
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Overview & Accounts' })).toBeTruthy();
  expect(screen.queryByRole('toolbar', { name: 'Workspace actions' })).toBeNull();
  expect(
    within(screen.getByRole('banner')).getByRole('button', { name: 'Add Account' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'External API' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', {
      name: 'Monitor',
    }),
  );
  expect(screen.getByRole('heading', { level: 1, name: 'Monitor' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Usage' })).toBeNull();
});

it('uses the selected application logo while accounts are loading', () => {
  vi.mocked(api.listAccounts).mockReturnValue(new Promise(() => {}));
  render(<App />);
  const logo = screen.getByRole('img', { name: 'LamDock' });
  expect(logo.getAttribute('src')).toContain('lam-orbit-icon.png');
});

it.each(['ellie', 'eLlie', 'ELLIE'])(
  'preserves the exact account-name case in preview and creation plan: %s',
  async (name) => {
    sessionItems.mockResolvedValue([]);
    vi.mocked(api.planCreateAccount).mockResolvedValue({
      operations: [],
      warnings: [],
      blocked: [],
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Codex Account' }));
    const input = screen.getByLabelText(/account name/i) as HTMLInputElement;
    expect(input.getAttribute('autocapitalize')).toBe('none');
    expect(input.getAttribute('autocorrect')).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
    fireEvent.change(input, { target: { value: name } });
    expect(input.value).toBe(name);
    expect(screen.getByText(`~/.codex-${name}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dry Run' }));
    await waitFor(() =>
      expect(api.planCreateAccount).toHaveBeenCalledWith(expect.objectContaining({ name })),
    );
  },
);

it('disables system name rewriting for Session import and PAT upload too', async () => {
  sessionItems.mockResolvedValue([]);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add Account' }));
  fireEvent.click(screen.getByRole('button', { name: 'Codex Account' }));
  fireEvent.click(screen.getByRole('button', { name: /import session/i }));
  const imported = screen.getByLabelText(/account name/i) as HTMLInputElement;
  expect(imported.getAttribute('autocapitalize')).toBe('none');
  expect(imported.getAttribute('autocorrect')).toBe('off');
  expect(imported.getAttribute('spellcheck')).toBe('false');
  fireEvent.change(imported, { target: { value: 'eLlie' } });
  expect(imported.value).toBe('eLlie');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('tab', { name: 'PAT' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Account' }));
  fireEvent.click(screen.getByRole('button', { name: 'Codex Account' }));
  const uploaded = screen.getByLabelText(/account name/i) as HTMLInputElement;
  expect(uploaded.getAttribute('autocapitalize')).toBe('none');
  expect(uploaded.getAttribute('autocorrect')).toBe('off');
  expect(uploaded.getAttribute('spellcheck')).toBe('false');
  fireEvent.change(uploaded, { target: { value: 'eLlie' } });
  expect(uploaded.value).toBe('eLlie');
});

it('keeps a startup maintenance issue visible after ordinary errors are cleared', async () => {
  vi.mocked(api.healthCheck).mockResolvedValue({
    ok: true,
    version: '0.4.4',
    homeRoot: '/tmp/review',
    startupIssue: 'Startup maintenance needs attention: CODEX_CONFIG_OWNERSHIP_CONFLICT',
  });
  render(<App />);
  expect((await screen.findByRole('alert')).textContent).toContain(
    'CODEX_CONFIG_OWNERSHIP_CONFLICT',
  );
  act(() => useAppStore.getState().clearError());
  expect(screen.getByRole('alert').textContent).toContain('CODEX_CONFIG_OWNERSHIP_CONFLICT');
});

it.each(['overview', 'sessions', 'providers', 'monitor', 'settings'] as const)(
  'provides visible global titlebar actions on %s',
  async (route) => {
    useAppStore.setState({ route });
    render(<App />);
    await waitFor(() => expect(useAppStore.getState().appReady).toBe(true));
    if (route !== 'overview') {
      expect(screen.queryByRole('toolbar', { name: 'Workspace actions' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'External API' })).toBeNull();
    }
    const create = screen.getByRole('button', { name: 'Add Account' });
    expect(create.closest('header')).toBeTruthy();
    const refresh = await screen.findByRole('button', { name: 'Refresh quotas' });
    expect(refresh.closest('header')).toBeTruthy();
    expect(document.querySelector('.statusbarOutside button')).toBeNull();
    if (route === 'providers')
      expect(screen.getByRole('button', { name: 'Add External API' })).toBeTruthy();
  },
);

it('refreshes from an icon-only titlebar button and disables it until completion', async () => {
  render(<App />);
  const refresh = await screen.findByRole('button', { name: 'Refresh quotas' });
  await waitFor(() => expect(refresh).toHaveProperty('disabled', false));
  expect(refresh.textContent?.trim()).toBe('');
  expect(refresh.getAttribute('title')).toBe('Refresh quotas');
  expect(screen.queryByText('Refresh Quotas')).toBeNull();
  const pending = deferred<CodexAccount[]>();
  const calls = vi.mocked(api.listAccounts).mock.calls.length;
  vi.mocked(api.listAccounts).mockReturnValueOnce(pending.promise);
  fireEvent.click(refresh);
  await waitFor(() => expect(api.listAccounts).toHaveBeenCalledTimes(calls + 1));
  expect(refresh).toHaveProperty('disabled', true);
  expect(refresh.getAttribute('aria-label')).toBe('Refreshing quotas');
  await act(async () => pending.resolve(accounts));
  await waitFor(() => expect(refresh).toHaveProperty('disabled', false));
});

it('uses only the single Providers page title and keeps global account creation available', async () => {
  useAppStore.setState({ route: 'providers' });
  render(<App />);
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Model Providers & Routing' }),
  ).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Providers' })).toBeNull();
  expect(document.querySelector('.workspacePageHeading')).toBeNull();
  expect(screen.queryByText('Your local account workspace.')).toBeNull();
  expect(
    screen.queryByText(
      'Configure upstream endpoints, inspect models and manage account connections.',
    ),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Add Account' }));
  fireEvent.click(screen.getByRole('button', { name: 'Codex Account' }));
  expect(await screen.findByRole('heading', { name: 'Add Account' })).toBeTruthy();
});

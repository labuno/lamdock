import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { version as appVersion } from '../package.json';
import { useAntigravityQuota } from './hooks/use-antigravity-quota';
import { useAppStore } from './stores/app';
import { useAccountStore } from './stores/accounts';
import { useSessionStore } from './stores/sessions';
import { useQuotaStore } from './stores/quota';
import { useProviderStore } from './stores/providers';
import * as api from './lib/api';
import * as Shell from './components/shell';
import {
  IconLogo,
  IconRefresh,
  IconPlus,
  IconSync,
  IconTrash,
  IconInfo,
  IconKey,
  IconCloud,
} from './components/icons';
import {
  ApiAccountConnectionEditor,
  ProviderCenter,
  ProviderEditor,
} from './components/provider-center';
import { ApiAccountFlow } from './components/api-account-flow';
import { ThemeToggle } from './components/theme-toggle';
import { UIButton } from './components/ui-button';
import { formatError, relaySessionLabel, sessionDisplayName } from './lib/format';
import { resolveAccountProvider } from './lib/provider-models';
import { quotaRefreshProfileIds } from './lib/quota';
import { routeTitle as routeTitleFromModule } from './routes/types';
import type {
  CreateAccountRequest,
  CodexSession,
  OperationPlan,
  RenameAccountRequest,
  ProfileAttachPlanViewV2,
  CodexAccount,
  SessionPageCursor,
  ProviderProfileViewV2,
} from './lib/types';
import * as Views from './routes/views';
import { RequestMonitor } from './routes/monitor';

type AuthMode = 'oauth' | 'pat';
type ModeAvailability = 'profile' | 'pat' | 'both';

const MODE_AVAILABILITY_KEY = 'lam-mode-availability';

function readModeAvailability(): ModeAvailability {
  const saved = localStorage.getItem(MODE_AVAILABILITY_KEY);
  if (saved === 'profile' || saved === 'pat' || saved === 'both') return saved;
  return 'both';
}

function clampAuthMode(mode: AuthMode, availability: ModeAvailability): AuthMode {
  if (availability === 'profile') return 'oauth';
  if (availability === 'pat') return 'pat';
  return mode;
}

function defaultCreateMode(availability: ModeAvailability): AuthMode {
  return availability === 'pat' ? 'pat' : 'oauth';
}

const emptyAccountReq: CreateAccountRequest = {
  name: 'luna',
  copyConfigFrom: null,
  overwriteWrapper: false,
};
const emptyRenameReq: RenameAccountRequest = {
  fromProfileId: '',
  toName: '',
  overwriteWrapper: false,
};
const HANDOFF_PAGE_SIZE = 5;

function mergeSessionLists(...lists: CodexSession[][]): CodexSession[] {
  const sessions = new Map<string, CodexSession>();
  for (const list of lists) {
    for (const session of list) {
      sessions.set(`${session.accountId}:${session.id}:${session.path}`, session);
    }
  }
  return [...sessions.values()].sort(
    (left, right) => right.modifiedAt - left.modifiedAt || left.path.localeCompare(right.path),
  );
}
function chatgptPlanTypeFromIdToken(idToken: unknown) {
  if (typeof idToken !== 'string') return '';
  const payload = idToken.split('.')[1];
  if (!payload) return '';
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(
      atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')),
    );
    return String(json['https://api.openai.com/auth']?.chatgpt_plan_type ?? '').trim();
  } catch {
    return '';
  }
}

export function App() {
  const {
    route,
    setRoute,
    themeMode,
    setThemeMode,
    health,
    status,
    error,
    appReady,
    modal,
    openModal,
    closeModal,
    hideDockIcon,
    setHideDockIcon,
    terminalTargets,
    terminalTargetId,
    codexLaunchPermissionPreset,
    setCodexLaunchPermissionPreset,
    setTerminalTargetId,
    compactButtons,
    setCompactButtons,
    gatewayFirstResponseTimeoutSeconds,
    setGatewayFirstResponseTimeoutSeconds,
    gatewayRequestTimeoutSeconds,
    setGatewayRequestTimeoutSeconds,
    antigravityPort,
    setAntigravityPort,
  } = useAppStore();
  const {
    accounts,
    selectedAccountId,
    setSelectedAccountId,
    activeSession,
    divergedStrategy,
    setDivergedStrategy,
    refreshing: refreshingAccounts,
    refresh,
    relayResumeTo,
    relaySessionTo,
    login,
    saveAccountNote,
    saveAccountProxy,
  } = useAccountStore();
  const {
    sessions,
    query,
    setQuery,
    resume,
    hasMore: hasMoreSessions,
    loading: loadingSessions,
    loadMoreSessions,
    mutationRunning,
    storageSummary,
    sort: sessionSort,
    ageFilter: sessionAgeFilter,
    deletableOnly,
    setDeletableOnly,
    setSort: setSessionSort,
    setAgeFilter: setSessionAgeFilter,
    selectAllFilteredSessions,
    deleteSelectedSessions,
    copyResume,
    openResume,
    openSessionDetails,
  } = useSessionStore();
  const {
    quotas,
    refreshingQuotaIds,
    resettingQuotaIds,
    refreshAccountQuota,
    resetAccountQuota,
    startAutoRefresh,
    stopAutoRefresh,
  } = useQuotaStore();
  const {
    providers,
    bindings,
    apiAccountConnection,
    loadApiAccountConnection,
    updateApiAccountConnection,
    clearApiAccountConnection,
    refreshProviderModels,
    saveProvider,
    rotateKeychainCredential,
  } = useProviderStore();

  const selectedAccount = useAccountStore((s) => s.selectedAccount());
  const selectedSession = useSessionStore((s) => s.selectedSession());
  const selectedSessionAccount = selectedSession
    ? accounts.find((a) => a.id === selectedSession.accountId)
    : undefined;

  // Modal form state (local — only needed while modal is open)
  const [accountReq, setAccountReq] = useState(emptyAccountReq);
  const [renameReq, setRenameReq] = useState(emptyRenameReq);
  const [plan, setPlan] = useState<OperationPlan | null>(null);
  const [handoffSourceId, setHandoffSourceId] = useState('');
  const [handoffTargetId, setHandoffTargetId] = useState('');
  const [handoffModel, setHandoffModel] = useState('');
  const [handoffSessionId, setHandoffSessionId] = useState('');
  const [handoffSessions, setHandoffSessions] = useState<CodexSession[]>([]);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffCursor, setHandoffCursor] = useState<SessionPageCursor | null>(null);
  const [handoffHasMore, setHandoffHasMore] = useState(false);
  const handoffPinnedSessionRef = useRef<CodexSession | null>(null);
  const handoffLoadGenerationRef = useRef(0);
  const selectedHandoffSession = handoffSessions.find((s) => s.id === handoffSessionId);
  const [updatePatAccount, setUpdatePatAccount] = useState<CodexAccount | null>(null);
  const [updatePatSessionJson, setUpdatePatSessionJson] = useState('');
  const [accountType, setAccountType] = useState<'choose' | 'codex' | 'api'>('choose');
  const [newPatSessionOpen, setNewPatSessionOpen] = useState(false);
  const [newPatSessionJson, setNewPatSessionJson] = useState('');
  const [profileSessionImportOpen, setProfileSessionImportOpen] = useState(false);
  const [profileSessionName, setProfileSessionName] = useState('');
  const [profileSessionJson, setProfileSessionJson] = useState('');
  const [profileSessionOverwriteWrapper, setProfileSessionOverwriteWrapper] = useState(false);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<CodexAccount | null>(null);
  const [modelSwitchTarget, setModelSwitchTarget] = useState<CodexAccount | null>(null);
  const [modelSwitchValue, setModelSwitchValue] = useState('');
  const [modelSwitchPlan, setModelSwitchPlan] = useState<ProfileAttachPlanViewV2 | null>(null);
  const [editingApiAccountId, setEditingApiAccountId] = useState<string | null>(null);
  const [editingGatewayProvider, setEditingGatewayProvider] =
    useState<ProviderProfileViewV2 | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const {
    quota: antigravityQuota,
    refreshing: refreshingAntigravity,
    load: loadAntigravity,
  } = useAntigravityQuota(antigravityPort, appReady);
  const [authMode, setAuthMode] = useState<AuthMode>('oauth');
  const [modeAvailability, setModeAvailability] = useState<ModeAvailability>(readModeAvailability);
  const [createMode, setCreateMode] = useState<AuthMode>(() => defaultCreateMode(modeAvailability));
  const modelSwitchProvider = modelSwitchTarget
    ? resolveAccountProvider(modelSwitchTarget, providers, bindings)
    : undefined;

  // Clear a removed model's preview before committing the updated catalog.
  if (
    modelSwitchProvider?.models.length &&
    !modelSwitchProvider.models.some((model) => model.id === modelSwitchValue)
  ) {
    const fallback = modelSwitchProvider.models.some(
      (model) => model.id === modelSwitchProvider.defaultModel,
    )
      ? modelSwitchProvider.defaultModel
      : modelSwitchProvider.models[0].id;
    setModelSwitchValue(fallback);
    setModelSwitchPlan(null);
  }

  function closeApiAccountEditor() {
    clearApiAccountConnection();
    setEditingApiAccountId(null);
  }

  function openApiAccountEditor(account: CodexAccount) {
    // Gateway-routed providers (e.g. Chat Completions accounts created through
    // the API account flow) are edited through the Provider editor, which can
    // rotate the stored credential. Only native Responses API accounts use the
    // dedicated API Account editor.
    const provider = resolveAccountProvider(account, providers, bindings);
    const binding = bindings.find((item) => item.profileId === account.id);
    const gatewayRouted =
      binding?.routeKind === 'gateway' ||
      (provider?.protocol ?? 'responses') === 'chat_completions';
    if (gatewayRouted && provider) {
      setEditingGatewayProvider(provider);
      return;
    }
    clearApiAccountConnection();
    setEditingApiAccountId(account.id);
    void loadApiAccountConnection(account.id).catch(() => setEditingApiAccountId(null));
  }

  // Load auth mode and settings on mount
  useEffect(() => {
    api.getAuthMode().then((mode) => {
      const savedAvailability = readModeAvailability();
      const backendMode = mode === 'pat' ? 'pat' : 'oauth';
      const nextMode = clampAuthMode(backendMode, savedAvailability);
      setModeAvailability(savedAvailability);
      if (savedAvailability !== 'both') {
        setCreateMode(defaultCreateMode(savedAvailability));
      }
      setAuthMode(nextMode);
      if (nextMode !== backendMode) {
        api.setAuthMode(nextMode).catch((err) => {
          useAppStore.getState().setError('Failed to save auth mode');
          console.error('Failed to save auth mode:', err);
        });
      }
    });
    useAppStore.getState().loadSettings();
  }, []);

  // Terminals installed while LamDock is running only show up if we probe again.
  useEffect(() => {
    if (route !== 'settings') return;
    useAppStore.getState().refreshTerminalTargets();
  }, [route]);

  // Save auth mode when changed
  const handleSetAuthMode = useCallback(
    (mode: AuthMode) => {
      const nextMode = clampAuthMode(mode, modeAvailability);
      setAuthMode(nextMode);
      api.setAuthMode(nextMode).catch((err) => {
        useAppStore.getState().setError('Failed to save auth mode');
        console.error('Failed to save auth mode:', err);
      });
    },
    [modeAvailability],
  );

  const handleSetModeAvailability = useCallback(
    (availability: ModeAvailability) => {
      localStorage.setItem(MODE_AVAILABILITY_KEY, availability);
      setModeAvailability(availability);
      const nextMode = clampAuthMode(authMode, availability);
      if (nextMode !== authMode) {
        setAuthMode(nextMode);
      }
      if (availability !== 'both') {
        setCreateMode(defaultCreateMode(availability));
      }
      api.setAuthMode(nextMode).catch((err) => {
        useAppStore.getState().setError('Failed to save auth mode');
        console.error('Failed to save auth mode:', err);
      });
    },
    [authMode],
  );

  const resolvedTheme = useMemo(() => {
    if (themeMode === 'system')
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return themeMode;
  }, [themeMode]);

  // Boot — run once on mount, refresh is a stable store action
  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Theme sync
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        themeMode === 'system' ? (media.matches ? 'dark' : 'light') : themeMode;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [themeMode]);

  // Reload sessions on account switch
  useEffect(() => {
    if (selectedAccountId) {
      void useSessionStore.getState().loadSessions(selectedAccountId);
      void useSessionStore.getState().loadSessionManagement(selectedAccountId);
    }
  }, [selectedAccountId]);

  // Auto-refresh quotas — start/stop are stable store actions
  useEffect(() => {
    const profileIds = quotaRefreshProfileIds(
      accounts,
      bindings.map((binding) => binding.profileId),
    );
    if (profileIds.length) startAutoRefresh(profileIds);
    return stopAutoRefresh;
  }, [accounts, bindings, startAutoRefresh, stopAutoRefresh]);

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([refresh({ refreshQuotasNow: true }), loadAntigravity(true)]);
  }, [refresh, loadAntigravity]);

  const footerStatus = useMemo(() => {
    if (!status) return api.inTauri() ? 'Ready' : 'Preview';
    if (status.startsWith('Refreshed')) {
      const stamp = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date());
      return `${status} • Today at ${stamp}`;
    }
    return status;
  }, [status]);

  useEffect(() => {
    if (modal !== 'handoff' || !handoffSourceId) return;
    const generation = ++handoffLoadGenerationRef.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHandoffLoading(true);
    api
      .listSessionsPage(handoffSourceId, { limit: HANDOFF_PAGE_SIZE })
      .then((page) => {
        if (generation !== handoffLoadGenerationRef.current) return;
        const items = mergeSessionLists(
          page.items,
          handoffPinnedSessionRef.current ? [handoffPinnedSessionRef.current] : [],
        );
        setHandoffSessions(items);
        setHandoffCursor(page.nextCursor ?? null);
        setHandoffHasMore(Boolean(page.nextCursor));
        setHandoffSessionId((current) =>
          items.some((item) => item.id === current) ? current : (items[0]?.id ?? ''),
        );
      })
      .catch((err) => {
        if (generation !== handoffLoadGenerationRef.current) return;
        setHandoffHasMore(false);
        useAppStore.getState().setError(formatError(err));
      })
      .finally(() => {
        if (generation !== handoffLoadGenerationRef.current) return;
        setHandoffLoading(false);
      });

    return () => {
      handoffLoadGenerationRef.current += 1;
    };
  }, [modal, handoffSourceId]);

  async function loadMoreHandoffSessions() {
    if (!handoffSourceId || !handoffCursor || handoffLoading) return;
    const generation = handoffLoadGenerationRef.current;
    setHandoffLoading(true);
    try {
      const page = await api.listSessionsPage(handoffSourceId, {
        limit: HANDOFF_PAGE_SIZE,
        cursor: handoffCursor,
      });
      if (generation !== handoffLoadGenerationRef.current) return;
      setHandoffSessions((current) => mergeSessionLists(current, page.items));
      setHandoffCursor(page.nextCursor ?? null);
      setHandoffHasMore(Boolean(page.nextCursor));
    } catch (err) {
      if (generation !== handoffLoadGenerationRef.current) return;
      useAppStore.getState().setError(formatError(err));
    } finally {
      if (generation === handoffLoadGenerationRef.current) setHandoffLoading(false);
    }
  }

  function changeHandoffSource(newSourceId: string) {
    handoffPinnedSessionRef.current = null;
    setHandoffSourceId(newSourceId);
    setHandoffSessionId('');
    setHandoffSessions([]);
    setHandoffCursor(null);
    setHandoffHasMore(false);
    setHandoffLoading(true);
    if (newSourceId === handoffTargetId) {
      const other = accounts.find((a) => a.id !== newSourceId)?.id ?? '';
      setHandoffTargetId(other);
      setHandoffModel(accounts.find((account) => account.id === other)?.model ?? '');
    }
  }

  // Modal helpers
  function openHandoffModal(opts?: { session?: CodexSession; targetAccountId?: string }) {
    const requestedTarget = opts?.targetAccountId;
    let source = opts?.session?.accountId ?? selectedAccount?.id ?? accounts[0]?.id ?? '';
    if (requestedTarget && requestedTarget === source) {
      source = accounts.find((a) => a.id !== requestedTarget)?.id ?? source;
    }
    const target =
      requestedTarget ?? accounts.find((a) => a.id !== source)?.id ?? accounts[0]?.id ?? '';
    handoffPinnedSessionRef.current = opts?.session ?? null;
    setHandoffSourceId(source);
    setHandoffTargetId(target);
    setHandoffModel(accounts.find((account) => account.id === target)?.model ?? '');
    setHandoffSessionId(opts?.session?.id ?? '');
    setHandoffSessions(opts?.session ? [opts.session] : []);
    setHandoffCursor(null);
    setHandoffHasMore(false);
    setHandoffLoading(true);
    openModal('handoff');
  }

  function openAccountModal() {
    setAccountType('choose');
    setNewPatSessionOpen(false);
    setNewPatSessionJson('');
    setProfileSessionImportOpen(false);
    openModal('account');
  }

  function openExternalApiModal() {
    openAccountModal();
    setAccountType('api');
  }

  async function handleApiAccountCreated(profileId: string) {
    await refresh();
    setSelectedAccountId(profileId);
    useAppStore.getState().setStatus(`Created API Account '${profileId}'`);
    closeModal();
  }

  function openRenameAccountModal(account: (typeof accounts)[number]) {
    setRenameReq({
      fromProfileId: account.id,
      toName: account.id,
      overwriteWrapper: false,
    });
    setPlan(null);
    openModal('renameAccount');
  }

  function openUpdatePatSessionModal(account: CodexAccount) {
    setUpdatePatAccount(account);
    setUpdatePatSessionJson('');
    openModal('updatePatSession');
  }

  async function updatePatSessionAuth() {
    if (!updatePatAccount) return;
    try {
      const authJson = JSON.parse(updatePatSessionJson);
      await api.updatePatSessionAuth(updatePatAccount.id, authJson);
      closeModal();
      await refresh();
      refreshAccountQuota(updatePatAccount.id);
      useAppStore.getState().setStatus(`Updated session auth for '${updatePatAccount.id}'`);
    } catch (err) {
      useAppStore.getState().setError(err instanceof Error ? err.message : 'Invalid session JSON');
    }
  }

  async function renameAccount() {
    if (!plan) return;
    const result = await api.executeRenameAccount(renameReq);
    closeModal();
    setPlan(null);
    useAppStore.getState().setStatus(`Renamed ${result.previousProfileId} to ${result.profileId}`);
    await refresh();
    setSelectedAccountId(result.profileId);
    await useSessionStore.getState().loadSessions(result.profileId);
  }

  function deleteProfileAccount(account: CodexAccount) {
    if (account.id === 'main') return;
    setDeleteAccountTarget(account);
  }

  async function confirmDeleteProfileAccount() {
    const account = deleteAccountTarget;
    if (!account || account.id === 'main') return;
    setDeletingAccountId(account.id);
    try {
      if (bindings.some((binding) => binding.profileId === account.id)) {
        await api.deleteApiAccountV2(account.id);
      } else {
        await api.deleteAccount({ profileId: account.id });
      }
      useAppStore.getState().setStatus(`Deleted ${account.displayName}`);
      setDeleteAccountTarget(null);
      await refresh();
      const remaining = useAccountStore.getState().accounts;
      const fallback = remaining.find((item) => item.id !== account.id)?.id ?? '';
      if (fallback) {
        setSelectedAccountId(fallback);
        await useSessionStore.getState().loadSessions(fallback);
      }
    } catch (err) {
      useAppStore.getState().setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingAccountId(null);
    }
  }

  async function handleSwitchAccount(account: CodexAccount) {
    if (authMode === 'pat') {
      try {
        await api.switchToPatAccount(account.id);
        await refresh();
        refreshAccountQuota('main');
        useAppStore
          .getState()
          .setStatus(`Codex App now uses ${account.displayName}. Restarting ChatGPT…`);
        await api.restartChatgpt();
      } catch (err) {
        useAppStore.getState().setStatus('Failed to switch the Codex App account');
        useAppStore.getState().setError(err instanceof Error ? err.message : String(err));
      }
    } else {
      login(account);
      try {
        await api.restartChatgpt();
      } catch {
        // Non-critical: ChatGPT restart is best-effort
      }
    }
  }

  async function exportCpa(account: CodexAccount) {
    try {
      const result = await api.exportCpaCredentials(account.id);
      const content = { ...result.content };
      if (!content.type) content.type = 'codex';
      if (content.websockets === undefined) content.websockets = true;
      if (!content.id_token) {
        content.id_token = '';
        content.id_token_synthetic = true;
      }
      const planType =
        chatgptPlanTypeFromIdToken(content.id_token) ||
        String(content.plan_type ?? content.chatgpt_plan_type ?? '').trim() ||
        quotas.find((quota) => quota.profileId === account.id)?.planType?.trim();
      if (planType) {
        content.plan_type = planType;
        content.chatgpt_plan_type = planType;
      }
      const blob = new Blob([JSON.stringify(content, null, 2) + '\n'], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
      useAppStore.getState().setStatus(`Exported CPA auth for '${account.id}'`);
    } catch (err) {
      useAppStore.getState().setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!appReady) {
    return (
      <div className="splash-container">
        <IconLogo size={130} className="splash-logo" alt="LamDock" aria-hidden={false} />
        <div className="splash-text">Loading LamDock...</div>
      </div>
    );
  }

  return (
    <main className="app-shell workspaceView">
      <header className="titlebar">
        <div className="titlebarLead">
          <span className="titlebarLogo" aria-hidden>
            <IconLogo size={24} />
          </span>
          <p className="titlebarBrand">LamDock</p>
          <span className="workspaceVersion">v{health?.version ?? appVersion}</span>
          <span className="workspaceDivider" aria-hidden>
            /
          </span>
          <span className="workspaceName">Workspace</span>
          <span className="workspaceLocalBadge">LOCAL</span>
        </div>
        <div className="titlebarActions">
          <div className="workspaceQuickActions" role="group" aria-label="Workspace quick actions">
            <UIButton
              variant="icon"
              size="sm"
              className={`workspaceRefreshButton ${refreshingAccounts || refreshingAntigravity ? 'isRefreshing' : ''}`}
              onClick={() => void handleRefreshAll()}
              disabled={refreshingAccounts || refreshingAntigravity}
              aria-label={
                refreshingAccounts || refreshingAntigravity ? 'Refreshing quotas' : 'Refresh quotas'
              }
              title={
                refreshingAccounts || refreshingAntigravity ? 'Refreshing quotas' : 'Refresh quotas'
              }
              aria-busy={refreshingAccounts || refreshingAntigravity}
            >
              <IconRefresh size={16} />
            </UIButton>
            <UIButton
              size="sm"
              className="workspaceCreateButton"
              onClick={openAccountModal}
              title="Add Account"
            >
              <IconPlus size={14} /> Add Account
            </UIButton>
          </div>
          <ThemeToggle value={themeMode} onChange={setThemeMode} />
          <div className="titlebarCenter">
            <div className="titlebarCenterCluster">
              {modeAvailability === 'both' ? (
                <div className="authModeTabs">
                  <input
                    type="checkbox"
                    aria-label="PAT Mode"
                    checked={authMode === 'pat'}
                    readOnly
                    style={{ display: 'none' }}
                  />
                  <div
                    role="tab"
                    aria-label="Profile"
                    aria-selected={authMode === 'oauth'}
                    className={`authModeTab ${authMode === 'oauth' ? 'active' : ''}`}
                    onClick={() => handleSetAuthMode('oauth')}
                  >
                    Profile
                    <div className="authModeTooltip">
                      <strong>Profile Mode (OAuth)</strong>
                      <p>
                        Workspace-scoped account profiles. Allows different workspaces or
                        directories to use separate logins.
                      </p>
                    </div>
                  </div>
                  <div
                    role="tab"
                    aria-label="PAT"
                    aria-selected={authMode === 'pat'}
                    className={`authModeTab ${authMode === 'pat' ? 'active' : ''}`}
                    onClick={() => handleSetAuthMode('pat')}
                  >
                    PAT
                    <div className="authModeTooltip">
                      <strong>PAT Mode (Tokens)</strong>
                      <p>
                        Personal Access Tokens mapped across workspaces. Suitable for simple user
                        credential switching.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="authModeTabs">
                  <input
                    type="checkbox"
                    aria-label="PAT Mode"
                    checked={authMode === 'pat'}
                    readOnly
                    style={{ display: 'none' }}
                  />
                  <div className="authModeTab active">
                    {modeAvailability === 'profile' ? 'Profile Mode' : 'PAT Mode'}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="workspaceIdentity">
            <span className="workspaceAvatar" aria-hidden>
              <IconLogo size={21} />
            </span>
            <div>
              <strong>Account workspace</strong>
              <span>{accounts.length} local profiles</span>
            </div>
          </div>
        </div>
      </header>

      <section className="content">
        {route !== 'providers' ? (
          <div className="workspacePageHeading">
            <div>
              <div className="workspaceHeadingLine">
                <h1>
                  {route === 'overview' ? 'Overview & Accounts' : routeTitleFromModule(route)}
                </h1>
                <span className={`workspaceConnection ${health?.ok ? 'isConnected' : ''}`}>
                  <span className="workspaceConnectionDot" aria-hidden />
                  {health?.ok
                    ? 'Desktop connected'
                    : api.inTauri()
                      ? 'Connecting'
                      : 'Browser preview'}
                </span>
              </div>
              <p>
                {route === 'overview'
                  ? 'Your accounts, sessions and official quotas in one place.'
                  : 'Your local account workspace.'}
              </p>
            </div>
          </div>
        ) : null}
        {health?.startupIssue ? (
          <div className="notice danger" role="alert">
            {health.startupIssue}
          </div>
        ) : null}
        {error ? <div className="notice danger">{error}</div> : null}
        {appReady && route === 'overview' ? (
          <Views.Overview
            accounts={accounts}
            quotas={quotas}
            providers={providers}
            select={setSelectedAccountId}
            rename={openRenameAccountModal}
            deleteAccount={deleteProfileAccount}
            editApiAccount={openApiAccountEditor}
            apiAccountIds={bindings.map((binding) => binding.profileId)}
            switchModel={(account) => {
              const provider = resolveAccountProvider(account, providers, bindings);
              setModelSwitchTarget(account);
              setModelSwitchValue(account.model ?? provider?.defaultModel ?? '');
              setModelSwitchPlan(null);
            }}
            login={(account) =>
              authMode === 'pat' && account.hasPersonalAccessToken
                ? openUpdatePatSessionModal(account)
                : login(account)
            }
            switchAccount={handleSwitchAccount}
            exportCpa={exportCpa}
            openHandoff={(account) => openHandoffModal({ targetAccountId: account.id })}
            relayLatest={relayResumeTo}
            currentSession={activeSession}
            refreshAccountQuota={refreshAccountQuota}
            resetAccountQuota={resetAccountQuota}
            refreshingQuotaIds={refreshingQuotaIds}
            resettingQuotaIds={resettingQuotaIds}
            antigravityQuota={antigravityQuota}
            refreshingAntigravity={refreshingAntigravity}
            onRefreshAntigravity={() => void loadAntigravity(true)}
            onSaveAccountNote={saveAccountNote}
            onSaveAccountProxy={saveAccountProxy}
            authMode={authMode}
            compactButtons={compactButtons}
            setCompactButtons={setCompactButtons}
          />
        ) : null}
        {appReady && route === 'sessions' ? (
          <Views.Sessions
            sessions={sessions}
            storageSummary={storageSummary}
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            setSelectedAccountId={setSelectedAccountId}
            query={query}
            setQuery={setQuery}
            copy={copyResume}
            open={openResume}
            details={openSessionDetails}
            openHandoff={(session) => openHandoffModal({ session })}
            hasMore={hasMoreSessions}
            loading={loadingSessions}
            loadMore={() => void loadMoreSessions()}
            mutationRunning={mutationRunning}
            sort={sessionSort}
            ageFilter={sessionAgeFilter}
            deletableOnly={deletableOnly}
            setDeletableOnly={(value) => void setDeletableOnly(value)}
            setSort={(sort) => void setSessionSort(sort)}
            setAgeFilter={(age) => void setSessionAgeFilter(age)}
            selectAllFiltered={selectAllFilteredSessions}
            deleteSelected={(paths) => void deleteSelectedSessions(paths)}
          />
        ) : null}

        {appReady && route === 'providers' ? (
          <ProviderCenter
            profiles={accounts.map((account) => account.id)}
            onAddExternalApi={openExternalApiModal}
          />
        ) : null}
        {appReady && route === 'monitor' ? <RequestMonitor /> : null}

        {appReady && route === 'settings' ? (
          <Views.Settings
            health={health}
            themeMode={themeMode}
            resolvedTheme={resolvedTheme}
            divergedStrategy={divergedStrategy}
            setDivergedStrategy={setDivergedStrategy}
            hideDockIcon={hideDockIcon}
            setHideDockIcon={setHideDockIcon}
            terminalTargets={terminalTargets}
            terminalTargetId={terminalTargetId}
            setTerminalTargetId={setTerminalTargetId}
            codexLaunchPermissionPreset={codexLaunchPermissionPreset}
            setCodexLaunchPermissionPreset={setCodexLaunchPermissionPreset}
            modeAvailability={modeAvailability}
            setModeAvailability={handleSetModeAvailability}
            compactButtons={compactButtons}
            setCompactButtons={setCompactButtons}
            gatewayFirstResponseTimeoutSeconds={gatewayFirstResponseTimeoutSeconds}
            setGatewayFirstResponseTimeoutSeconds={setGatewayFirstResponseTimeoutSeconds}
            gatewayRequestTimeoutSeconds={gatewayRequestTimeoutSeconds}
            setGatewayRequestTimeoutSeconds={setGatewayRequestTimeoutSeconds}
            antigravityPort={antigravityPort}
            setAntigravityPort={setAntigravityPort}
          />
        ) : null}
      </section>

      <footer className="bottomDock">
        <div className="bottomDockIsland">
          <Shell.BottomNav route={route} setRoute={setRoute} />
        </div>
      </footer>

      <div className="statusbarOutside">
        <div className="statusbarOutsideLeft">
          <span className="statusbarMain">{footerStatus}</span>
          {selectedSession?.providerMismatch ? (
            <span className="statusHint">Provider mismatch</span>
          ) : null}
        </div>
        <span className="bottomDockMeta">
          <span className={`statusDot ${health?.ok ? 'ok' : ''}`} aria-hidden />
          {health?.ok ? 'Operational' : 'Checking…'}
          <span className="bottomDockVersion">{`v${health?.version ?? appVersion}`}</span>
        </span>
      </div>

      {deleteAccountTarget ? (
        <Shell.Modal
          title="Delete Account"
          close={() => {
            if (!deletingAccountId) setDeleteAccountTarget(null);
          }}
        >
          <div className="deleteAccountConfirm">
            <p>
              Delete <strong>{deleteAccountTarget.displayName}</strong> and all local files under:
            </p>
            <code>{deleteAccountTarget.codexHome}</code>
            <p>
              This will terminate local processes using this profile, remove the profile directory,
              remove its wrapper, and refresh the account list.
            </p>
            <div className="modalFoot">
              <UIButton
                type="button"
                variant="ghost"
                disabled={Boolean(deletingAccountId)}
                onClick={() => setDeleteAccountTarget(null)}
              >
                Cancel
              </UIButton>
              <div className="modalFootPrimary">
                <UIButton
                  type="button"
                  variant="danger"
                  disabled={Boolean(deletingAccountId)}
                  onClick={confirmDeleteProfileAccount}
                >
                  <IconTrash size={14} />
                  {deletingAccountId ? 'Deleting...' : 'Delete Account'}
                </UIButton>
              </div>
            </div>
          </div>
        </Shell.Modal>
      ) : null}

      {editingApiAccountId ? (
        <Shell.Modal title="API Account Configuration" close={closeApiAccountEditor} wide>
          {apiAccountConnection?.profileId === editingApiAccountId ? (
            <ApiAccountConnectionEditor
              connection={apiAccountConnection}
              onSave={async (request) => {
                await updateApiAccountConnection(request);
                closeApiAccountEditor();
              }}
              onRefreshModels={async () => {
                const provider = await refreshProviderModels(apiAccountConnection.providerId);
                return provider.models;
              }}
              onCancel={closeApiAccountEditor}
            />
          ) : (
            <div className="emptyBox">Loading API account…</div>
          )}
        </Shell.Modal>
      ) : null}

      {editingGatewayProvider ? (
        <Shell.Modal title="Edit API Account" close={() => setEditingGatewayProvider(null)} wide>
          <ProviderEditor
            provider={editingGatewayProvider}
            simpleCredentials
            onRefreshModels={async () => {
              const refreshed = await refreshProviderModels(editingGatewayProvider.id);
              return refreshed.models;
            }}
            onSave={async (definition, keychainSecret) => {
              try {
                await saveProvider(definition, true);
                if (keychainSecret) {
                  const expectedCredential =
                    definition.upstreamAuth.kind === 'none'
                      ? { kind: 'none' as const }
                      : definition.upstreamAuth.credential;
                  await rotateKeychainCredential(definition.id, expectedCredential, keychainSecret);
                }
                setEditingGatewayProvider(null);
              } catch (error) {
                useAppStore.getState().setError(formatError(error));
                throw error;
              }
            }}
            onCancel={() => setEditingGatewayProvider(null)}
          />
        </Shell.Modal>
      ) : null}

      {modal === 'account' ? (
        <Shell.Modal title="Add Account" close={closeModal} wide={accountType === 'api'}>
          {accountType === 'choose' ? (
            <>
              <p className="accountTypeIntro">Choose how you want to connect an account.</p>
              <div className="accountTypeChoices">
                <UIButton
                  className="accountTypeChoice"
                  aria-label="Codex Account"
                  onClick={() => setAccountType('codex')}
                >
                  <IconKey size={24} />
                  <strong>Codex Account</strong>
                  <span>Sign in with Codex or import an existing login.</span>
                </UIButton>
                <UIButton
                  className="accountTypeChoice"
                  aria-label="External API"
                  onClick={() => setAccountType('api')}
                >
                  <IconCloud size={24} />
                  <strong>External API</strong>
                  <span>Connect a provider with a base URL, API key and models.</span>
                </UIButton>
              </div>
              <div className="modalFoot">
                <UIButton variant="ghost" onClick={closeModal}>
                  Cancel
                </UIButton>
              </div>
            </>
          ) : (
            <>
              <div className="accountTypeBranchBar">
                <UIButton
                  variant="ghost"
                  size="sm"
                  aria-label="Choose account type"
                  onClick={() => setAccountType('choose')}
                >
                  ← Account types
                </UIButton>
                <strong>{accountType === 'api' ? 'External API' : 'Codex Account'}</strong>
              </div>
              {accountType === 'api' ? (
                <ApiAccountFlow
                  providers={providers}
                  onCancel={closeModal}
                  onCreated={handleApiAccountCreated}
                />
              ) : (
                <>
                  <div className="createModeTabs">
                    {modeAvailability !== 'pat' ? (
                      <button
                        className={createMode === 'oauth' ? 'active' : ''}
                        onClick={() => {
                          setCreateMode('oauth');
                          setProfileSessionImportOpen(false);
                        }}
                      >
                        Profile Account
                      </button>
                    ) : null}
                    {modeAvailability !== 'profile' ? (
                      <button
                        className={createMode === 'pat' ? 'active' : ''}
                        onClick={() => {
                          setCreateMode('pat');
                          setNewPatSessionOpen(false);
                        }}
                      >
                        PAT Account
                      </button>
                    ) : null}
                  </div>

                  {createMode === 'oauth' ? (
                    <>
                      <div className="subModeTabs">
                        <button
                          type="button"
                          className={!profileSessionImportOpen ? 'active' : ''}
                          onClick={() => setProfileSessionImportOpen(false)}
                        >
                          CLI Auth
                        </button>
                        <button
                          type="button"
                          className={profileSessionImportOpen ? 'active' : ''}
                          onClick={() => setProfileSessionImportOpen(true)}
                        >
                          Import Session
                        </button>
                      </div>

                      {profileSessionImportOpen ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const name = profileSessionName.trim();
                            if (!name) {
                              useAppStore.getState().setError('Please provide an account name');
                              return;
                            }
                            try {
                              const sessionJson = JSON.parse(profileSessionJson);
                              const result = await api.addSessionProfileAccount({
                                accountId: name,
                                sessionJson,
                                overwriteWrapper: profileSessionOverwriteWrapper,
                              });
                              await refresh();
                              setSelectedAccountId(result.profileId);
                              await useSessionStore.getState().loadSessions(result.profileId);
                              useAppStore
                                .getState()
                                .setStatus(`Imported session profile '${result.profileId}'`);
                              closeModal();
                            } catch (err) {
                              useAppStore
                                .getState()
                                .setError(
                                  err instanceof Error
                                    ? err.message
                                    : 'Failed to import session profile',
                                );
                            }
                          }}
                        >
                          <div className="formGrid formGrid--single">
                            <label>
                              Account name *
                              <input
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                value={profileSessionName}
                                onChange={(e) => setProfileSessionName(e.target.value)}
                                placeholder="luna"
                                required
                              />
                            </label>
                          </div>

                          <div className="credentialsWarning">
                            <IconInfo size={16} />
                            <span>
                              Sensitive credentials - Do not share or expose session JSON files.
                              Only paste trusted session data.
                            </span>
                          </div>

                          <label>
                            Session JSON *
                            <textarea
                              value={profileSessionJson}
                              onChange={(e) => setProfileSessionJson(e.target.value)}
                              rows={8}
                              placeholder='{"accessToken":"...","idToken":"..."}'
                              required
                            />
                          </label>
                          <div className="previewBox">
                            <div className="previewLine">
                              <span>CODEX_HOME</span>
                              <strong>~/.codex-{profileSessionName || 'name'}</strong>
                            </div>
                            <div className="previewLine">
                              <span>Auth</span>
                              <strong>Converted Codex auth.json</strong>
                            </div>
                          </div>
                          <label className="syncOption">
                            <input
                              type="checkbox"
                              checked={profileSessionOverwriteWrapper}
                              onChange={(e) => setProfileSessionOverwriteWrapper(e.target.checked)}
                            />
                            <span>
                              <strong>Overwrite wrapper if it exists</strong>
                              <span>The imported profile remains a separate CODEX_HOME.</span>
                            </span>
                          </label>
                          <div className="modalFoot">
                            <UIButton type="button" variant="ghost" onClick={closeModal}>
                              Cancel
                            </UIButton>
                            <div className="modalFootPrimary">
                              <UIButton type="submit" variant="primary">
                                <IconSync size={14} /> Import Profile
                              </UIButton>
                            </div>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="formGrid">
                            <label>
                              Account name *
                              <input
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                value={accountReq.name}
                                onChange={(e) =>
                                  setAccountReq({ ...accountReq, name: e.target.value })
                                }
                                required
                              />
                            </label>
                            <label>
                              Copy config from
                              <select
                                value={accountReq.copyConfigFrom ?? ''}
                                onChange={(e) =>
                                  setAccountReq({
                                    ...accountReq,
                                    copyConfigFrom: e.target.value || null,
                                  })
                                }
                              >
                                <option value="">None</option>
                                {accounts
                                  .filter((a) => a.hasConfig)
                                  .map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.id}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          </div>
                          <div className="previewBox">
                            <div className="previewLine">
                              <span>CODEX_HOME</span>
                              <strong>~/.codex-{accountReq.name || 'name'}</strong>
                            </div>
                            <div className="previewLine">
                              <span>Wrapper</span>
                              <strong>~/bin/codex-{accountReq.name || 'name'}</strong>
                            </div>
                          </div>
                          <label className="syncOption">
                            <input
                              type="checkbox"
                              checked={accountReq.overwriteWrapper}
                              onChange={(e) =>
                                setAccountReq({ ...accountReq, overwriteWrapper: e.target.checked })
                              }
                            />
                            <span>
                              <strong>Overwrite wrapper if it exists</strong>
                              <span>
                                Keeps CODEX_HOME untouched; only wrapper script is replaced.
                              </span>
                            </span>
                          </label>
                          <Views.PlanView plan={plan} />
                          <div className="modalFoot">
                            <UIButton type="button" variant="ghost" onClick={closeModal}>
                              Cancel
                            </UIButton>
                            <div className="modalFootPrimary">
                              <UIButton
                                type="button"
                                onClick={async () =>
                                  setPlan(await api.planCreateAccount(accountReq))
                                }
                              >
                                Dry Run
                              </UIButton>
                              <UIButton
                                type="button"
                                variant="primary"
                                disabled={!plan}
                                onClick={async () => {
                                  await api.executeCreateAccount(accountReq);
                                  closeModal();
                                  setPlan(null);
                                  await refresh();
                                }}
                              >
                                Create
                              </UIButton>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div>
                      <div className="subModeTabs">
                        <button
                          type="button"
                          className={!newPatSessionOpen ? 'active' : ''}
                          onClick={() => {
                            setNewPatSessionOpen(false);
                          }}
                        >
                          Upload auth.json
                        </button>
                        <button
                          type="button"
                          className={newPatSessionOpen ? 'active' : ''}
                          onClick={() => setNewPatSessionOpen(true)}
                        >
                          Token & Session
                        </button>
                      </div>

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const accountName = (
                            (formData.get('accountName') as string) || ''
                          ).trim();
                          const personalAccessToken = (
                            (formData.get('personalAccessToken') as string) || ''
                          ).trim();
                          const expirationInput = (
                            (formData.get('tokenExpiration') as string) || ''
                          ).trim();

                          if (!accountName) {
                            useAppStore.getState().setError('Please provide an account name');
                            return;
                          }

                          try {
                            const file = formData.get('authFile') as File | null;
                            const authJson = newPatSessionOpen
                              ? JSON.parse(newPatSessionJson)
                              : JSON.parse(await file!.text());

                            const result = await api.addPatAccount({
                              accountId: accountName,
                              authJson,
                              personalAccessToken: personalAccessToken || null,
                              tokenExpiration: expirationInput
                                ? new Date(expirationInput).toISOString()
                                : null,
                            });

                            await refresh();
                            refreshAccountQuota(result.accountId);
                            useAppStore
                              .getState()
                              .setStatus(`Uploaded auth.json for '${result.accountId}'`);
                            closeModal();
                          } catch (err) {
                            useAppStore
                              .getState()
                              .setError(
                                err instanceof Error ? err.message : 'Failed to upload auth.json',
                              );
                          }
                        }}
                      >
                        <div className="uploadPatForm">
                          <label>
                            Account name *
                            <input
                              name="accountName"
                              type="text"
                              placeholder="luna"
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              required
                            />
                            <span className="inputHint">
                              This will create ~/.codex-{'{'}name{'}'}/
                            </span>
                          </label>

                          {newPatSessionOpen ? (
                            <>
                              <label>
                                Personal Access Token *
                                <input
                                  name="personalAccessToken"
                                  type="password"
                                  placeholder="Enter token"
                                  autoComplete="off"
                                  required
                                />
                              </label>
                              <div className="credentialsWarning">
                                <IconInfo size={16} />
                                <span>
                                  Sensitive credentials - Do not share or expose session JSON files.
                                  Only paste trusted session data.
                                </span>
                              </div>
                              <label>
                                Paste Session JSON *
                                <textarea
                                  value={newPatSessionJson}
                                  onChange={(e) => setNewPatSessionJson(e.target.value)}
                                  rows={8}
                                  placeholder='{"accessToken":"...","idToken":"..."}'
                                  required
                                />
                              </label>
                            </>
                          ) : (
                            <label className="fileUploadLabel">
                              Select auth.json file *
                              <input
                                name="authFile"
                                type="file"
                                accept=".json,application/json"
                                required
                              />
                            </label>
                          )}

                          <label>
                            Token expiration (optional)
                            <input name="tokenExpiration" type="datetime-local" />
                          </label>
                        </div>
                        <div className="modalFoot">
                          <UIButton type="button" variant="ghost" onClick={closeModal}>
                            Cancel
                          </UIButton>
                          <div className="modalFootPrimary">
                            <UIButton type="submit" variant="primary">
                              <IconSync size={14} /> {newPatSessionOpen ? 'Save' : 'Upload'}
                            </UIButton>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Shell.Modal>
      ) : null}

      {modelSwitchTarget ? (
        <Shell.Modal
          title={`Switch model · ${modelSwitchTarget.displayName}`}
          close={() => {
            setModelSwitchTarget(null);
            setModelSwitchPlan(null);
          }}
        >
          <label>
            Model
            <select
              aria-label="API Account model"
              value={modelSwitchValue}
              onChange={(event) => {
                setModelSwitchValue(event.target.value);
                setModelSwitchPlan(null);
              }}
            >
              {modelSwitchProvider?.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          {modelSwitchPlan ? (
            <div className="previewBox">
              <div className="previewLine">
                <span>CODEX_HOME</span>
                <strong>{modelSwitchTarget.codexHome}</strong>
              </div>
              <div className="previewLine">
                <span>New default model</span>
                <strong>{modelSwitchPlan.selectedModel}</strong>
              </div>
            </div>
          ) : null}
          <div className="modalFoot">
            <UIButton type="button" variant="ghost" onClick={() => setModelSwitchTarget(null)}>
              Cancel
            </UIButton>
            <div className="modalFootPrimary">
              <UIButton
                type="button"
                onClick={async () => {
                  setModelSwitchPlan(
                    await api.planApiAccountModelSwitchV2(modelSwitchTarget.id, modelSwitchValue),
                  );
                }}
              >
                Review
              </UIButton>
              <UIButton
                type="button"
                variant="primary"
                disabled={!modelSwitchPlan || Boolean(modelSwitchPlan.blockers.length)}
                onClick={async () => {
                  if (!modelSwitchPlan) return;
                  await api.executeApiAccountModelSwitchV2(
                    modelSwitchPlan.planId,
                    modelSwitchPlan.fingerprint,
                  );
                  useAppStore
                    .getState()
                    .setStatus(`Switched ${modelSwitchTarget.displayName} to ${modelSwitchValue}`);
                  setModelSwitchTarget(null);
                  setModelSwitchPlan(null);
                  await refresh();
                }}
              >
                Switch Model
              </UIButton>
            </div>
          </div>
        </Shell.Modal>
      ) : null}

      {modal === 'updatePatSession' && updatePatAccount ? (
        <Shell.Modal title="Update Session Auth" close={closeModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void updatePatSessionAuth();
            }}
          >
            <label>
              Session JSON
              <textarea
                value={updatePatSessionJson}
                onChange={(e) => setUpdatePatSessionJson(e.target.value)}
                rows={12}
                placeholder='{"user":{"email":"you@example.com"},"accessToken":"...","idToken":"..."}'
                required
              />
            </label>
            <div className="modalFoot">
              <UIButton type="button" variant="ghost" onClick={closeModal}>
                Cancel
              </UIButton>
              <div className="modalFootPrimary">
                <UIButton type="submit" variant="primary">
                  Update
                </UIButton>
              </div>
            </div>
          </form>
        </Shell.Modal>
      ) : null}

      {modal === 'renameAccount' ? (
        <Shell.Modal title="Rename Account" close={closeModal}>
          <div className="formGrid">
            <label>
              Current account
              <select
                value={renameReq.fromProfileId}
                onChange={(e) => {
                  setRenameReq({ ...renameReq, fromProfileId: e.target.value });
                  setPlan(null);
                }}
              >
                {accounts
                  .filter((a) => a.id !== 'main')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              New account name
              <input
                value={renameReq.toName}
                onChange={(e) => {
                  setRenameReq({ ...renameReq, toName: e.target.value });
                  setPlan(null);
                }}
              />
            </label>
          </div>
          <div className="previewBox">
            <div className="previewLine">
              <span>From</span>
              <strong>~/.codex-{renameReq.fromProfileId || 'source'}</strong>
            </div>
            <div className="previewLine">
              <span>To</span>
              <strong>~/.codex-{renameReq.toName || 'name'}</strong>
            </div>
            <div className="previewLine">
              <span>Wrapper</span>
              <strong>~/bin/codex-{renameReq.toName || 'name'}</strong>
            </div>
          </div>
          <label className="syncOption">
            <input
              type="checkbox"
              checked={renameReq.overwriteWrapper}
              onChange={(e) => {
                setRenameReq({ ...renameReq, overwriteWrapper: e.target.checked });
                setPlan(null);
              }}
            />
            <span>
              <strong>Overwrite target wrapper if it exists</strong>
              <span>Profile directory conflicts are always blocked.</span>
            </span>
          </label>
          <div className="notice">
            Close any running Codex process that uses this profile before renaming. auth.json is
            kept inside the moved CODEX_HOME and is not copied.
          </div>
          <Views.PlanView plan={plan} />
          <div className="modalFoot">
            <UIButton type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </UIButton>
            <div className="modalFootPrimary">
              <UIButton
                type="button"
                onClick={async () => setPlan(await api.planRenameAccount(renameReq))}
              >
                Dry Run
              </UIButton>
              <UIButton type="button" variant="primary" disabled={!plan} onClick={renameAccount}>
                Rename
              </UIButton>
            </div>
          </div>
        </Shell.Modal>
      ) : null}

      {modal === 'handoff' ? (
        <Shell.Modal title="Handoff Session" close={closeModal}>
          <div className="formGrid handoffForm">
            <label>
              Source account
              <select value={handoffSourceId} onChange={(e) => changeHandoffSource(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Session
              <select
                value={handoffSessionId}
                onChange={(e) => setHandoffSessionId(e.target.value)}
                disabled={handoffLoading || !handoffSessions.length}
              >
                {handoffSessions.map((s) => (
                  <option key={`${s.accountId}-${s.id}-${s.path}`} value={s.id}>
                    {relaySessionLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Target account
              <select
                value={handoffTargetId}
                onChange={(e) => {
                  const id = e.target.value;
                  setHandoffTargetId(id);
                  setHandoffModel(accounts.find((account) => account.id === id)?.model ?? '');
                }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === handoffSourceId}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Target model
              <input
                aria-label="Target model"
                title="Uses the target account default. Change it for this handoff only."
                value={handoffModel}
                onChange={(event) => setHandoffModel(event.target.value)}
                placeholder="Model ID"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
          </div>
          {handoffHasMore ? (
            <div className="modalInlineActions">
              <UIButton
                type="button"
                variant="ghost"
                onClick={() => void loadMoreHandoffSessions()}
                disabled={handoffLoading}
              >
                {handoffLoading ? 'Loading...' : 'Load earlier sessions'}
              </UIButton>
            </div>
          ) : null}
          <div className="previewBox">
            <div className="previewLine">
              <span>Source</span>
              <strong>
                {accounts.find((a) => a.id === handoffSourceId)?.displayName ??
                  (handoffSourceId || 'source')}
              </strong>
            </div>
            <div className="previewLine">
              <span>Target runtime</span>
              <strong>
                {accounts.find((a) => a.id === handoffTargetId)?.displayName ??
                  (handoffTargetId || 'target')}
              </strong>
            </div>
            <div className="previewLine">
              <span>Session</span>
              <strong>
                {selectedHandoffSession
                  ? relaySessionLabel(selectedHandoffSession)
                  : handoffLoading
                    ? 'Loading...'
                    : 'No session selected'}
              </strong>
            </div>
          </div>
          <div className="notice">
            Handoff copies the selected session transcript to the target account when needed, never
            auth.json or API secrets.
          </div>
          <div className="modalFoot">
            <UIButton type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </UIButton>
            <div className="modalFootPrimary">
              <UIButton
                type="button"
                variant="primary"
                disabled={
                  !handoffSessionId ||
                  !handoffSourceId ||
                  !handoffTargetId ||
                  !handoffModel.trim() ||
                  handoffLoading ||
                  handoffSourceId === handoffTargetId
                }
                onClick={async () => {
                  const session = handoffSessions.find((s) => s.id === handoffSessionId);
                  const target = accounts.find((a) => a.id === handoffTargetId);
                  if (!session || !target) return;
                  const success = await relaySessionTo(session, target, handoffModel.trim());
                  if (!success) return;
                  closeModal();
                  await refresh();
                }}
              >
                Start Handoff
              </UIButton>
            </div>
          </div>
        </Shell.Modal>
      ) : null}

      {modal === 'sessionDetail' && selectedSession ? (
        <Shell.Modal title="Session Details" wide close={closeModal}>
          <div className="detailTitleRow">
            <h3 className="detailTitle">{sessionDisplayName(selectedSession)}</h3>
            {selectedSession.providerMismatch ? <span className="badge warn">mismatch</span> : null}
          </div>
          {selectedSession.providerMismatch ? (
            <p className="notice warn">
              Resume can continue, but runtime behavior, cost, and tool compatibility may differ.
            </p>
          ) : null}
          <div className="detailGrid">
            <div className="detailItem">
              <span className="detailLabel">Account</span>
              <strong>{selectedSessionAccount?.codexHome ?? selectedSession.accountId}</strong>
            </div>
            <div className="detailItem">
              <span className="detailLabel">cwd</span>
              <strong>{selectedSession.cwd ?? 'unknown'}</strong>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Session ID</span>
              <strong className="mono">{selectedSession.id}</strong>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Session file</span>
              <strong className="mono">{selectedSession.path}</strong>
            </div>
            {selectedSession.summary ? (
              <div className="detailItem detailItem--full">
                <span className="detailLabel">Summary</span>
                <div className="detailSummary">{selectedSession.summary}</div>
              </div>
            ) : null}
            <div className="detailItem">
              <span className="detailLabel">Original provider</span>
              <strong>
                {selectedSession.originalProviderId ?? 'unknown'} ·{' '}
                {selectedSession.originalModel ?? 'unknown'}
              </strong>
            </div>
            <div className="detailItem">
              <span className="detailLabel">Runtime provider</span>
              <strong>
                {selectedSession.currentProviderId ?? 'unknown'} ·{' '}
                {selectedSession.currentModel ?? 'unknown'}
              </strong>
            </div>
          </div>
          {resume ? (
            <div className="notice safe">
              <strong>Resume command preview</strong>
              <div className="sideEffectsSubtle">Only executed via Copy/Open actions.</div>
              <div className="code">{resume.command}</div>
            </div>
          ) : (
            <div className="notice">Select a session to preview resume command.</div>
          )}
          <div className="modalFoot">
            <UIButton type="button" variant="ghost" onClick={closeModal}>
              Close
            </UIButton>
            <div className="modalFootPrimary">
              <UIButton type="button" onClick={() => copyResume(selectedSession)}>
                Copy
              </UIButton>
              <UIButton type="button" variant="primary" onClick={() => openResume(selectedSession)}>
                Open Terminal
              </UIButton>
            </div>
          </div>
        </Shell.Modal>
      ) : null}
    </main>
  );
}

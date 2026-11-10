import { invoke } from '@tauri-apps/api/core';
import type { RequestMonitorSnapshot } from './types';
import type {
  AppTarget,
  CodexAccount,
  SessionPage,
  SessionPageRequest,
  SessionQueryRequest,
  SessionSelectionRequest,
  CodexLaunchPermissionPreset,
  SessionStorageSummary,
  DeleteSessionsRequest,
  DeleteSessionsResult,
  AccountNoteUpdate,
  UpdateAccountProxyRequest,
  CreateAccountRequest,
  CreateResult,
  DeleteAccountRequest,
  DeleteAccountResult,
  HealthCheck,
  OperationPlan,
  ResetQuotaResult,
  RelayResumeRequest,
  RelayResumeResult,
  RenameAccountRequest,
  RenameAccountResult,
  ResumeCommand,
  ResumeCommandRequest,
  TerminalTarget,
  UsageQuotaSnapshot,
  AntigravityQuotaResponse,
  TokenExpirationStatus,
  AddPatAccountRequest,
  AddPatAccountResult,
  AddSessionProfileAccountRequest,
  CpaExport,
  CreateProviderRequestV2,
  DeleteProviderRequestV2,
  DeleteProviderResultV2,
  CreateProviderWithKeychainRequestV2,
  UpdateProviderRequestV2,
  ProviderListViewV2,
  ProviderProfileViewV2,
  PlanAttachRequestV2,
  ExecuteAttachRequestV2,
  ExecuteDetachRequestV2,
  ProfileAttachPlanViewV2,
  ProfileDetachPlanViewV2,
  ProfileProviderBindingViewV2,
  AttachExecutionViewV2,
  RotateProviderCredentialRequestV2,
  CredentialRotationViewV2,
  ProviderUpstreamTestViewV2,
  RefreshProviderModelsRequestV2,
  ApproveAuthCommandRequestV2,
  AuthCommandApprovalListV2,
  AuthCommandApprovalViewV2,
  PlanApiAccountRequestV2,
  ApiAccountPlanViewV2,
  ExecuteApiAccountRequestV2,
  ApiAccountExecutionViewV2,
  ApiAccountConnectionViewV2,
  UpdateApiAccountConnectionRequestV2,
  DiscoverProviderModelsRequestV2,
  DiscoverProviderModelsViewV2,
} from './types';

type TauriInternals = {
  invoke?: unknown;
};

export const inTauri = () => {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: TauriInternals })
    .__TAURI_INTERNALS__;
  return Boolean(
    internals && typeof internals === 'object' && typeof internals.invoke === 'function',
  );
};

export async function healthCheck(): Promise<HealthCheck> {
  if (!inTauri()) {
    return { ok: false, version: 'browser-preview', homeRoot: 'not connected' };
  }
  return invoke<HealthCheck>('health_check');
}

export async function listAccounts(): Promise<CodexAccount[]> {
  if (!inTauri()) return [];
  return invoke<CodexAccount[]>('list_accounts');
}

export async function listCachedAccounts(): Promise<CodexAccount[]> {
  if (!inTauri()) return [];
  return invoke<CodexAccount[]>('list_cached_accounts');
}

export async function listSessionsPage(
  accountId: string,
  req: SessionPageRequest = {},
): Promise<SessionPage> {
  if (!inTauri()) return { items: [], nextCursor: null };
  return invoke<SessionPage>('list_sessions_page', { accountId, req });
}

export async function querySessionsPage(
  accountId: string,
  req: SessionQueryRequest = {},
): Promise<SessionPage> {
  if (!inTauri()) return { items: [], nextCursor: null };
  return invoke<SessionPage>('query_sessions_page', { accountId, req });
}

export async function queryDeletableSessionPaths(
  accountId: string,
  req: SessionSelectionRequest = {},
): Promise<string[]> {
  if (!inTauri()) return [];
  return invoke<string[]>('query_deletable_session_paths', { accountId, req });
}

export async function getSessionStorageSummary(accountId: string): Promise<SessionStorageSummary> {
  if (!inTauri()) {
    return {
      evaluatedAt: 0,
      activeCount: 0,
      activeBytes: 0,
      eligibleCount: 0,
      eligibleBytes: 0,
      retainedRecentCount: 20,
      minimumAgeDays: 7,
    };
  }
  return invoke<SessionStorageSummary>('get_session_storage_summary', { accountId });
}

export async function deleteSessions(req: DeleteSessionsRequest): Promise<DeleteSessionsResult> {
  return invoke<DeleteSessionsResult>('delete_sessions', { req });
}

export async function planCreateAccount(req: CreateAccountRequest): Promise<OperationPlan> {
  return invoke<OperationPlan>('plan_create_account', { req });
}

export async function executeCreateAccount(req: CreateAccountRequest): Promise<CreateResult> {
  return invoke<CreateResult>('execute_create_account', { req });
}

export async function planRenameAccount(req: RenameAccountRequest): Promise<OperationPlan> {
  return invoke<OperationPlan>('plan_rename_account', { req });
}

export async function executeRenameAccount(
  req: RenameAccountRequest,
): Promise<RenameAccountResult> {
  return invoke<RenameAccountResult>('execute_rename_account', { req });
}

export async function deleteAccount(req: DeleteAccountRequest): Promise<DeleteAccountResult> {
  return invoke<DeleteAccountResult>('delete_account', { req });
}

export async function updateAccountNote(req: AccountNoteUpdate): Promise<CodexAccount> {
  return invoke<CodexAccount>('update_account_note', { req });
}

export async function updateAccountProxy(req: UpdateAccountProxyRequest): Promise<CodexAccount> {
  return invoke<CodexAccount>('update_account_proxy', { req });
}

export async function buildResumeCommand(req: ResumeCommandRequest): Promise<ResumeCommand> {
  return invoke<ResumeCommand>('build_resume_command', { req });
}

export async function openTerminalWithResume(req: ResumeCommandRequest): Promise<void> {
  return invoke<void>('open_terminal_with_resume', { req });
}

export async function openTerminalWithCommand(command: string): Promise<void> {
  return invoke<void>('open_terminal_with_command', { command });
}

export async function relayResumeSession(req: RelayResumeRequest): Promise<RelayResumeResult> {
  return invoke<RelayResumeResult>('relay_resume_session', { req });
}

export async function buildLoginCommand(profileId: string): Promise<ResumeCommand> {
  return invoke<ResumeCommand>('build_login_command', { profileId });
}

export async function openTerminalForLogin(profileId: string): Promise<void> {
  return invoke<void>('open_terminal_for_login', { profileId });
}

export async function listTerminalTargets(): Promise<TerminalTarget[]> {
  if (!inTauri())
    return [{ id: 'terminal', displayName: 'Terminal.app', kind: 'terminal', installed: true }];
  return invoke<TerminalTarget[]>('list_terminal_targets');
}

export async function getSelectedTerminalTarget(): Promise<string> {
  if (!inTauri()) return 'terminal';
  return invoke<string>('get_selected_terminal_target');
}

export async function setSelectedTerminalTarget(targetId: string): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>('set_selected_terminal_target', { targetId });
}

export async function getProfileQuota(
  profileId: string,
  forceRefresh = false,
): Promise<UsageQuotaSnapshot> {
  return invoke<UsageQuotaSnapshot>('get_profile_quota', { profileId, forceRefresh });
}

export async function resetProfileQuota(profileId: string): Promise<ResetQuotaResult> {
  return invoke<ResetQuotaResult>('reset_profile_quota', { profileId });
}

export async function listCachedQuotas(profileIds?: string[]): Promise<UsageQuotaSnapshot[]> {
  if (!inTauri()) return [];
  return invoke<UsageQuotaSnapshot[]>('list_cached_quotas', { profileIds });
}

export async function syncTrayQuota(): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>('sync_tray_quota');
}

export async function queryRequestMonitor(): Promise<RequestMonitorSnapshot> {
  if (!inTauri()) throw new Error('Open the desktop app to read local gateway requests.');
  return invoke<RequestMonitorSnapshot>('query_request_monitor');
}

export async function setQuotaPopoverOpacity(percent: number): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>('set_quota_popover_opacity', { percent });
}

export async function hideQuotaPopover(): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>('hide_quota_popover');
}

function providerListContractMismatch(): Error & { code: string } {
  const error = new Error('Provider list response does not match the V2 contract') as Error & {
    code: string;
  };
  error.code = 'PROVIDER_LIST_CONTRACT_MISMATCH';
  return error;
}

export async function listProvidersV2(): Promise<ProviderListViewV2> {
  const result = await invoke<unknown>('list_providers_v2');
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    !('revision' in result) ||
    !Number.isSafeInteger(result.revision) ||
    (result.revision as number) < 0 ||
    !('providers' in result) ||
    !Array.isArray(result.providers)
  ) {
    throw providerListContractMismatch();
  }
  return result as ProviderListViewV2;
}

export async function createProviderV2(
  req: CreateProviderRequestV2,
): Promise<ProviderProfileViewV2> {
  return invoke<ProviderProfileViewV2>('create_provider_v2', { req });
}

export async function discoverProviderModelsV2(
  req: DiscoverProviderModelsRequestV2,
): Promise<DiscoverProviderModelsViewV2> {
  return invoke<DiscoverProviderModelsViewV2>('discover_provider_models_v2', { req });
}

export async function listProviderAuthCommandApprovalsV2(): Promise<AuthCommandApprovalListV2> {
  return invoke<AuthCommandApprovalListV2>('list_provider_auth_command_approvals_v2');
}

export async function approveProviderAuthCommandV2(
  req: ApproveAuthCommandRequestV2,
): Promise<AuthCommandApprovalViewV2> {
  return invoke<AuthCommandApprovalViewV2>('approve_provider_auth_command_v2', { req });
}

export async function createProviderWithKeychainV2(
  req: CreateProviderWithKeychainRequestV2,
): Promise<ProviderProfileViewV2> {
  return invoke<ProviderProfileViewV2>('create_provider_with_keychain_v2', { req });
}

export async function updateProviderV2(
  req: UpdateProviderRequestV2,
): Promise<ProviderProfileViewV2> {
  return invoke<ProviderProfileViewV2>('update_provider_v2', { req });
}

export async function deleteProviderV2(
  req: DeleteProviderRequestV2,
): Promise<DeleteProviderResultV2> {
  return invoke<DeleteProviderResultV2>('delete_provider_v2', { req });
}

export async function rotateProviderCredentialV2(
  req: RotateProviderCredentialRequestV2,
): Promise<CredentialRotationViewV2> {
  return invoke<CredentialRotationViewV2>('rotate_provider_credential_v2', { req });
}

export async function testProviderUpstreamV2(
  providerId: string,
): Promise<ProviderUpstreamTestViewV2> {
  return invoke<ProviderUpstreamTestViewV2>('test_provider_upstream_v2', { providerId });
}

export async function refreshProviderModelsV2(
  req: RefreshProviderModelsRequestV2,
): Promise<ProviderProfileViewV2> {
  return invoke<ProviderProfileViewV2>('refresh_provider_models_v2', { req });
}

export async function listProfileProviderBindingsV2(): Promise<ProfileProviderBindingViewV2[]> {
  return invoke<ProfileProviderBindingViewV2[]>('list_profile_provider_bindings_v2');
}

export async function planAttachProviderV2(
  req: PlanAttachRequestV2,
): Promise<ProfileAttachPlanViewV2> {
  return invoke<ProfileAttachPlanViewV2>('plan_attach_provider_v2', { req });
}

export async function executeAttachProviderV2(
  req: ExecuteAttachRequestV2,
): Promise<AttachExecutionViewV2> {
  return invoke<AttachExecutionViewV2>('execute_attach_provider_v2', { req });
}

export async function planDetachProviderV2(profileId: string): Promise<ProfileDetachPlanViewV2> {
  return invoke<ProfileDetachPlanViewV2>('plan_detach_provider_v2', { profileId });
}

export async function executeDetachProviderV2(
  req: ExecuteDetachRequestV2,
): Promise<AttachExecutionViewV2> {
  return invoke<AttachExecutionViewV2>('execute_detach_provider_v2', { req });
}

export async function planApiAccountV2(
  req: PlanApiAccountRequestV2,
): Promise<ApiAccountPlanViewV2> {
  return invoke<ApiAccountPlanViewV2>('plan_api_account_v2', { req });
}

export async function executeApiAccountV2(
  req: ExecuteApiAccountRequestV2,
): Promise<ApiAccountExecutionViewV2> {
  return invoke<ApiAccountExecutionViewV2>('execute_api_account_v2', { req });
}

export async function planApiAccountModelSwitchV2(
  profileId: string,
  selectedModel: string,
): Promise<ProfileAttachPlanViewV2> {
  return invoke<ProfileAttachPlanViewV2>('plan_api_account_model_switch_v2', {
    profileId,
    selectedModel,
  });
}

export async function executeApiAccountModelSwitchV2(
  planId: string,
  fingerprint: string,
): Promise<AttachExecutionViewV2> {
  return invoke<AttachExecutionViewV2>('execute_api_account_model_switch_v2', {
    planId,
    fingerprint,
  });
}

export async function getApiAccountConnectionV2(
  profileId: string,
): Promise<ApiAccountConnectionViewV2> {
  return invoke<ApiAccountConnectionViewV2>('get_api_account_connection_v2', { profileId });
}

export async function updateApiAccountConnectionV2(
  req: UpdateApiAccountConnectionRequestV2,
): Promise<ApiAccountConnectionViewV2> {
  return invoke<ApiAccountConnectionViewV2>('update_api_account_connection_v2', { req });
}

export async function deleteApiAccountV2(profileId: string): Promise<DeleteAccountResult> {
  return invoke<DeleteAccountResult>('delete_api_account_v2', { profileId });
}

export async function getAntigravityQuota(): Promise<AntigravityQuotaResponse> {
  if (!inTauri()) {
    return { ok: false, models: [], error: 'Not in Tauri environment' };
  }
  return invoke<AntigravityQuotaResponse>('get_antigravity_quota');
}

export async function checkProfileTokenExpiration(
  profileId: string,
): Promise<TokenExpirationStatus> {
  return invoke<TokenExpirationStatus>('check_profile_token_expiration', { profileId });
}

export async function addPatAccount(req: AddPatAccountRequest): Promise<AddPatAccountResult> {
  return invoke<AddPatAccountResult>('add_pat_account', { req });
}

export async function addSessionProfileAccount(
  req: AddSessionProfileAccountRequest,
): Promise<CreateResult> {
  return invoke<CreateResult>('add_session_profile_account', { req });
}

export async function switchToPatAccount(accountId: string): Promise<void> {
  return invoke<void>('switch_to_pat_account', { accountId });
}

export async function getAppTarget(): Promise<AppTarget> {
  return invoke<AppTarget>('get_app_target');
}

export async function exportCpaCredentials(profileId: string): Promise<CpaExport> {
  return invoke<CpaExport>('export_cpa_credentials', { profileId });
}

export async function updatePatSessionAuth(
  profileId: string,
  authJson: Record<string, unknown>,
): Promise<void> {
  return invoke<void>('update_pat_session_auth', { profileId, authJson });
}

export async function getAuthMode(): Promise<string> {
  if (!inTauri()) return 'oauth';
  return invoke<string>('get_auth_mode');
}

export async function setAuthMode(mode: string): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>('set_auth_mode', { mode });
}

export async function getGatewayFirstResponseTimeoutSeconds(): Promise<number> {
  if (!inTauri()) return 60;
  return invoke<number>('get_gateway_first_response_timeout_seconds');
}

export async function setGatewayFirstResponseTimeoutSeconds(seconds: number): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>('set_gateway_first_response_timeout_seconds', { seconds });
}

export async function getGatewayRequestTimeoutSeconds(): Promise<number> {
  if (!inTauri()) return 20 * 60;
  return invoke<number>('get_gateway_request_timeout_seconds');
}

export async function setGatewayRequestTimeoutSeconds(seconds: number): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>('set_gateway_request_timeout_seconds', { seconds });
}

export async function getCodexLaunchPermissionPreset(): Promise<CodexLaunchPermissionPreset> {
  if (!inTauri()) return 'askForApproval';
  return invoke<CodexLaunchPermissionPreset>('get_codex_launch_permission_preset');
}

export async function setCodexLaunchPermissionPreset(
  preset: CodexLaunchPermissionPreset,
): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>('set_codex_launch_permission_preset', { preset });
}

export async function getAntigravityPort(): Promise<number | null> {
  if (!inTauri()) return null;
  return invoke<number | null>('get_antigravity_port');
}

export async function setAntigravityPort(port: number | null): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>('set_antigravity_port', { port });
}

export async function getHideDockIcon(): Promise<boolean> {
  if (!inTauri()) return false;
  return invoke<boolean>('get_hide_dock_icon');
}

export async function setHideDockIcon(hide: boolean): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>('set_hide_dock_icon', { hide });
}

export async function restartChatgpt(): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>('restart_chatgpt');
}

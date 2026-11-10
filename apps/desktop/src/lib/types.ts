export type HealthCheck = {
  ok: boolean;
  version: string;
  homeRoot: string;
  startupIssue?: string | null;
};

export type AppTarget = {
  kind: 'account' | 'provider' | 'customProvider';
  accountId: string | null;
  providerId: string | null;
};

export type CodexAccount = {
  id: string;
  displayName: string;
  codexHome: string;
  wrapperPath?: string | null;
  hasAuth: boolean;
  hasConfig: boolean;
  hasHistory: boolean;
  sessionCount: number;
  latestSessionModifiedAt?: number | null;
  managed: boolean;
  isRelay: boolean;
  relaySource?: string | null;
  relayIdentity?: string | null;
  providerId?: string | null;
  model?: string | null;
  authMode?: string | null;
  isActiveAuth?: boolean;
  hasPersonalAccessToken?: boolean;
  renewalDate?: string | null;
  note?: string | null;
  proxy?: AccountProxySettings | null;
};

export type AccountProxySettings = {
  enabled: boolean;
  url: string;
};

export type UpdateAccountProxyRequest = AccountProxySettings & {
  profileId: string;
};

export type CodexSession = {
  id: string;
  accountId: string;
  path: string;
  modifiedAt: number;
  sizeBytes: number;
  cwd?: string | null;
  threadName?: string | null;
  summary?: string | null;
  firstUserMessage?: string | null;
  model?: string | null;
  originalProviderId?: string | null;
  originalModel?: string | null;
  currentProviderId?: string | null;
  currentModel?: string | null;
  providerMismatch: boolean;
  deletable?: boolean;
  deletionProtectionReason?: string | null;
};

export type SessionPageCursor = {
  modifiedAt: number;
  sizeBytes?: number | null;
  path: string;
};

export type SessionSort = 'newest' | 'largest' | 'smallest';
export type SessionAgeFilter = 'all' | 'last7Days' | 'last30Days' | 'olderThan30Days';
export type CodexLaunchPermissionPreset = 'askForApproval' | 'approveForMe' | 'fullAccess';

export type SessionPageRequest = {
  limit?: number | null;
  cursor?: SessionPageCursor | null;
};

export type SessionQueryRequest = SessionPageRequest & {
  deletableOnly?: boolean;
  sort?: SessionSort | null;
  age?: SessionAgeFilter | null;
};

export type SessionSelectionRequest = {
  age?: SessionAgeFilter | null;
  query?: string | null;
};

export type SessionPage = {
  items: CodexSession[];
  nextCursor?: SessionPageCursor | null;
};

export type SessionStorageSummary = {
  evaluatedAt: number;
  activeCount: number;
  activeBytes: number;
  eligibleCount: number;
  eligibleBytes: number;
  retainedRecentCount: number;
  minimumAgeDays: number;
};

export type DeleteSessionsRequest = {
  profileId: string;
  paths: string[];
};

export type DeleteSessionsResult = {
  deletedCount: number;
  deletedBytes: number;
};

export type OperationPlan = {
  operations: string[];
  warnings: string[];
  blocked: string[];
};

export type CreateAccountRequest = {
  name: string;
  copyConfigFrom?: string | null;
  overwriteWrapper: boolean;
};

export type RenameAccountRequest = {
  fromProfileId: string;
  toName: string;
  overwriteWrapper: boolean;
};

export type CreateResult = {
  profileId: string;
  homePath: string;
  wrapperPath: string;
  operations: string[];
  warnings: string[];
};

export type RenameAccountResult = {
  profileId: string;
  previousProfileId: string;
  homePath: string;
  previousHomePath: string;
  wrapperPath: string;
  previousWrapperPath: string;
  operations: string[];
  warnings: string[];
};

export type DeleteAccountRequest = {
  profileId: string;
};

export type DeleteAccountResult = {
  profileId: string;
  removedHomePath: string;
  removedWrapperPath?: string | null;
};

export type AccountNoteUpdate = {
  profileId: string;
  renewalDate?: string | null;
  note?: string | null;
};

export type CpaExport = {
  fileName: string;
  content: Record<string, unknown>;
};

export type ResumeCommandRequest = {
  profileId: string;
  sessionId?: string | null;
  cwd?: string | null;
};

export type ResumeCommand = {
  command: string;
  sideEffects: string[];
};

export type TerminalTarget = {
  id: string;
  displayName: string;
  kind: 'terminal' | 'app' | string;
  installed: boolean;
};

export type RelayResumeRequest = {
  targetModel?: string | null;
  fromProfileId: string;
  toProfileId: string;
  sessionId: string;
  cwd?: string | null;
  divergedStrategy?: DivergedSessionStrategy | null;
  confirmCompatibilityLoss?: boolean;
};

export type RelayResumeResult = {
  action: string;
  fromProfileId: string;
  toProfileId: string;
  sessionId: string;
  sourcePath: string;
  targetPath: string;
  backupPath?: string | null;
  forkPath?: string | null;
  handoffPath?: string | null;
  resume: ResumeCommand;
  warnings: string[];
  compatibility?: {
    disposition: 'compatible' | 'compatible_with_loss' | 'blocked';
    confirmationRequired: boolean;
    issues: Array<{
      itemId: string;
      itemType: string;
      reason: string;
      recoveryAction: string;
    }>;
    transformations: Array<{
      itemId: string;
      itemType: string;
      action: string;
      warning: string;
    }>;
  } | null;
  compatibilityFingerprint?: string | null;
};

export type DivergedSessionStrategy =
  | 'stop_and_ask'
  | 'summarize_fork_with_target_account'
  | 'timeline_merge_to_fork'
  | 'prefer_source'
  | 'prefer_target';

export type UsageQuotaSnapshot = {
  profileId: string;
  source: string;
  fetchedAt: number;
  staleness: string;
  planType?: string | null;
  primaryUsedPercent?: number | null;
  primaryWindowDurationMins?: number | null;
  secondaryUsedPercent?: number | null;
  secondaryWindowDurationMins?: number | null;
  remainingPercent?: number | null;
  resetAt?: string | null;
  secondaryResetAt?: string | null;
  resetCreditCount?: number | null;
  resetCreditExpiresAt?: string | null;
  resetCreditExpirySource?: 'api' | 'manual_config' | 'unknown' | null;
  resetCreditDetails?: ResetCreditDetail[];
  resetCreditDetailStatus?: 'available' | 'unsupported' | 'unavailable' | 'disabled' | null;
  resetCreditDetailError?: string | null;
  alerts: string[];
  suggestedActions: string[];
};

export type ResetCreditDetail = {
  id?: string | null;
  status?: string | null;
  expiresAt?: string | null;
  source: 'api' | 'manual_config';
};

export type ResetQuotaResult = {
  snapshot: UsageQuotaSnapshot;
  outcome: string;
  operationId: string;
};

export type ProviderProfile = {
  id: string;
  name: string;
  baseUrl: string;
  wireApi: string;
  defaultModel: string;
  envKey?: string | null;
  secretStorage: string;
  health: string;
};

export type SecretInput =
  | { kind: 'env'; envKey: string }
  | { kind: 'keychain'; secret: string }
  | { kind: 'none' };

export type CreateProviderRequest = {
  id: string;
  name: string;
  baseUrl: string;
  wireApi: string;
  defaultModel: string;
  envKey?: string | null;
  secret?: SecretInput | null;
};

export type AttachProviderRequest = {
  profileId: string;
  providerId: string;
  model?: string | null;
};

export type AttachProviderResult = {
  profileId: string;
  providerId: string;
  configPath: string;
  backupPath: string;
  operations: string[];
  warnings: string[];
};

export type ProviderProtocolV2 = 'responses' | 'chat_completions';
export type RouteKindV2 = 'direct' | 'gateway';

export type CredentialReferenceV2 =
  | { kind: 'env'; envKey: string }
  | { kind: 'keychain'; service: 'lam.remote-provider'; account: string; version: number }
  | { kind: 'auth_command'; approvalId: string }
  | { kind: 'codex_profile'; profileId: string }
  | { kind: 'none' };

export type UpstreamAuthV2 =
  | { kind: 'bearer'; credential: CredentialReferenceV2 }
  | { kind: 'header'; name: string; credential: CredentialReferenceV2 }
  | { kind: 'none' };

export type AdapterV2 =
  | { kind: 'none' }
  | { kind: 'local'; adapterId: string; upstreamPath: string };

export type ProviderDefinitionV2 = {
  id: string;
  name: string;
  protocol: ProviderProtocolV2;
  baseUrl: string;
  defaultModel: string;
  models: Array<{ id: string; label: string; contextWindow?: number }>;
  upstreamAuth: UpstreamAuthV2;
  adapter: AdapterV2;
  compatibilityProfile?: string;
  codex: {
    displayName?: string;
    streamIdleTimeoutMs?: number;
    directRequestMaxRetries?: number;
    directStreamMaxRetries?: number;
    routeViaGateway?: boolean;
    queryParams: Record<string, string>;
    envHttpHeaders: Record<string, string>;
    reasoningEffort?: string;
  };
};

export type ProviderModelV2 = ProviderDefinitionV2['models'][number];

export type CreateProviderRequestV2 = {
  expectedRevision: number;
  provider: ProviderDefinitionV2;
};
export type UpdateProviderRequestV2 = CreateProviderRequestV2;
export type DeleteProviderRequestV2 = {
  expectedRevision: number;
  providerId: string;
};
export type DeleteProviderResultV2 = {
  providerId: string;
  storeRevision: number;
};

export type DiscoverProviderModelsRequestV2 = {
  baseUrl: string;
  apiKey: string;
};

export type DiscoverProviderModelsViewV2 = {
  models: Array<{ id: string; label: string; contextWindow?: number }>;
};

export type ApproveAuthCommandRequestV2 = {
  expectedRevision: number;
  executable: string;
  args: string[];
  timeoutMs: number;
  maxStdoutBytes: number;
  refreshIntervalMs: number;
};

export type AuthCommandApprovalViewV2 = {
  revision: number;
  approvalId: string;
  executable: string;
};

export type AuthCommandApprovalListV2 = {
  revision: number;
  approvals: AuthCommandApprovalViewV2[];
};

export type ProviderProfileViewV2 = {
  id: string;
  name: string;
  protocol: ProviderProtocolV2;
  baseUrl: string;
  defaultModel: string;
  models: Array<{ id: string; label: string; contextWindow?: number }>;
  upstreamAuth: UpstreamAuthV2;
  adapter: AdapterV2;
  compatibilityProfile?: string;
  codex: ProviderDefinitionV2['codex'];
  storeRevision: number;
  usedBy: string[];
  readinessBlockers: string[];
  readiness?: { ready: boolean; blockers: string[]; bindingCount: number };
  capabilities?: {
    streaming: {
      effective: 'supported' | 'partial' | 'unsupported' | 'unknown';
      provenance: string;
    };
    functionTools: {
      effective: 'supported' | 'partial' | 'unsupported' | 'unknown';
      provenance: string;
    };
    structuredOutputs: {
      effective: 'supported' | 'partial' | 'unsupported' | 'unknown';
      provenance: string;
    };
    reasoning: {
      effective: 'supported' | 'partial' | 'unsupported' | 'unknown';
      provenance: string;
    };
    evidenceCurrent: boolean;
    evidenceFingerprint?: string | null;
    evidenceFixtureIds: string[];
  };
  lastHealth?: {
    providerId: string;
    observedAt: string;
    ok: boolean;
    latencyMs?: number;
    errorCode?: string;
  };
};

export type ProviderListViewV2 = {
  revision: number;
  providers: ProviderProfileViewV2[];
};

export type CreateProviderWithKeychainRequestV2 = {
  expectedRevision: number;
  provider: ProviderDefinitionV2;
  secret: string;
};

export type PlanAttachRequestV2 = {
  profileId: string;
  providerId: string;
  selectedModel: string;
};
export type ExecuteAttachRequestV2 = { planId: string; fingerprint: string };
export type ExecuteDetachRequestV2 = ExecuteAttachRequestV2;

export type ApiAccountProviderSelectionV2 =
  | { kind: 'new'; provider: ProviderDefinitionV2 }
  | { kind: 'existing'; providerId: string };

export type PlanApiAccountRequestV2 = {
  accountName: string;
  selectedModel: string;
  overwriteWrapper: boolean;
  provider: ApiAccountProviderSelectionV2;
};

export type ApiAccountPlanViewV2 = {
  planId: string;
  fingerprint: string;
  expiresAtMs: number;
  accountName: string;
  providerId: string;
  selectedModel: string;
  routeKind: RouteKindV2;
  operations: string[];
  warnings: string[];
  blockers: string[];
};

export type ExecuteApiAccountRequestV2 = {
  planId: string;
  fingerprint: string;
  apiKey?: string | null;
};

export type ApiAccountExecutionViewV2 = {
  account: CreateResult;
  provider: ProviderProfileViewV2;
  binding: ProfileProviderBindingViewV2;
  attach: AttachExecutionViewV2;
};

export type ApiAccountConnectionViewV2 = {
  profileId: string;
  providerId: string;
  protocol: 'responses';
  baseUrl: string;
  selectedModel: string;
  providerStoreRevision: number;
  apiKeyConfigured: boolean;
  models: ProviderModelV2[];
  reasoningEffort?: string;
};

export type UpdateApiAccountConnectionRequestV2 = {
  profileId: string;
  expectedProviderStoreRevision: number;
  baseUrl: string;
  apiKey?: string;
  models?: ProviderModelV2[];
  selectedModel?: string;
  reasoningEffort?: string;
};

export type ProfileAttachPlanViewV2 = {
  planId: string;
  fingerprint: string;
  expiresAtMs: number;
  profileId: string;
  providerId: string;
  selectedModel: string;
  routeKind: RouteKindV2;
  blockers: string[];
  warnings: string[];
  operations: string[];
  redactedPreview: string;
  expectedProviderStoreRevision: number;
  expectedBindingStoreRevision: number;
  expectedBindingRevision?: number | null;
  sourceConfigHash: string;
};

export type ProfileDetachPlanViewV2 = {
  planId: string;
  fingerprint: string;
  expiresAtMs: number;
  profileId: string;
  expectedBindingStoreRevision: number;
  expectedBindingRevision: number;
  sourceConfigHash: string;
};

export type ProfileProviderBindingViewV2 = {
  profileId: string;
  providerId: string;
  selectedModel: string;
  routeKind: RouteKindV2;
  revision: number;
  providerRevision: number;
};

export type AttachExecutionViewV2 = {
  operationId?: string | null;
  state: string;
  idempotent: boolean;
};

export type RotateProviderCredentialRequestV2 = {
  expectedRevision: number;
  providerId: string;
  expectedCredential: CredentialReferenceV2;
  secret: string;
};

export type CredentialRotationViewV2 = {
  provider: ProviderProfileViewV2;
  cleanupPending: boolean;
};

export type ProviderUpstreamTestViewV2 = {
  providerId: string;
  ok: boolean;
  routeKind: RouteKindV2;
  modelsEndpoint: string;
  redactedSummary: string;
  modelCount: number;
};

export type RefreshProviderModelsRequestV2 = {
  providerId: string;
  expectedRevision: number;
};

export type StructuredErrorViewV2 = {
  code: string;
  message: string;
  recoverable: boolean;
  recoveryActions: string[];
};

export type AntigravityModelQuota = {
  label: string;
  remainingFraction?: number | null;
  resetTime?: string | null;
};

export type AntigravityQuotaBucket = {
  bucketId?: string | null;
  displayName: string;
  description?: string | null;
  window?: string | null;
  remainingFraction?: number | null;
  resetTime?: string | null;
  disabled?: boolean | null;
};

export type AntigravityQuotaGroup = {
  displayName: string;
  description?: string | null;
  buckets: AntigravityQuotaBucket[];
};

export type AntigravityQuotaResponse = {
  ok: boolean;
  models: AntigravityModelQuota[];
  description?: string | null;
  groups?: AntigravityQuotaGroup[];
  error?: string | null;
};

export type TokenExpirationStatus = {
  profileId: string;
  isExpired: boolean;
  daysUntilExpiration?: number | null;
  expirationDate?: string | null;
  warningLevel: string; // "ok" | "warning" | "critical" | "expired"
};

export type AddPatAccountRequest = {
  accountId: string;
  authJson: Record<string, unknown>;
  personalAccessToken?: string | null;
  tokenExpiration?: string | null;
};

export type AddSessionProfileAccountRequest = {
  accountId: string;
  sessionJson: Record<string, unknown>;
  overwriteWrapper: boolean;
};

export type AddPatAccountResult = {
  accountId: string;
  email: string;
  expired: string;
};
/** Upstream-reported fields. Missing values remain unknown. */
export interface MonitoredRequest {
  recordId: string;
  requestId: string;
  startedAt: string;
  model: string | null;
  providerHash: string;
  profileHash: string | null;
  status: number;
  streamState?: string | null;
  outcomeCode?: string | null;
  latencyMs: number;
  headersMs?: number | null;
  ttftMs?: number | null;
  retryCount: number;
  usage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    cachedInputTokens?: number | null;
    reasoningOutputTokens?: number | null;
  } | null;
}

export interface RequestMonitorSnapshot {
  records: MonitoredRequest[];
  providerNames: Record<string, string>;
  profileNames: Record<string, string>;
  earliestRecordedAt: string | null;
  readAt: string;
  legacyRecords: number;
  invalidRecords: number;
  pendingLine: boolean;
  truncated: boolean;
  recordLimit: number;
}

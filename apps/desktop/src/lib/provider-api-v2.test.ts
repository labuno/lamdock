import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProviderV2,
  executeAttachProviderV2,
  executeDetachProviderV2,
  listProfileProviderBindingsV2,
  listProvidersV2,
  planAttachProviderV2,
  planDetachProviderV2,
  updateProviderV2,
  rotateProviderCredentialV2,
  createProviderWithKeychainV2,
  testProviderUpstreamV2,
  discoverProviderModelsV2,
} from './api';
import type { CreateProviderRequestV2, ProviderListViewV2 } from './types';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

const request: CreateProviderRequestV2 = {
  expectedRevision: 0,
  provider: {
    id: 'company-proxy',
    name: 'Company Proxy',
    protocol: 'responses',
    baseUrl: 'https://proxy.example.test/v1',
    defaultModel: 'model-a',
    models: [{ id: 'model-a', label: 'Model A' }],
    upstreamAuth: { kind: 'bearer', credential: { kind: 'env', envKey: 'COMPANY_TOKEN' } },
    adapter: { kind: 'none' },
    codex: { queryParams: {}, envHttpHeaders: {} },
  },
};

beforeEach(() => mockInvoke.mockReset());

describe('Provider V2 API wrappers', () => {
  it('passes create/update/list requests without shape conversion', async () => {
    const providerList: ProviderListViewV2 = { revision: 7, providers: [] };
    mockInvoke
      .mockResolvedValueOnce(providerList)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    await expect(listProvidersV2()).resolves.toEqual(providerList);
    await createProviderV2(request);
    await updateProviderV2({ ...request, expectedRevision: 1 });
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'list_providers_v2');
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'create_provider_v2', { req: request });
    expect(mockInvoke).toHaveBeenNthCalledWith(3, 'update_provider_v2', {
      req: { ...request, expectedRevision: 1 },
    });
  });

  it('rejects the legacy Provider array response with an explicit contract error', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    await expect(listProvidersV2()).rejects.toMatchObject({
      code: 'PROVIDER_LIST_CONTRACT_MISMATCH',
    });
  });

  it.each([
    null,
    {},
    { revision: -1, providers: [] },
    { revision: 1.5, providers: [] },
    { revision: 1, providers: null },
  ])('rejects malformed Provider list payload %#', async (payload) => {
    mockInvoke.mockResolvedValueOnce(payload);

    await expect(listProvidersV2()).rejects.toMatchObject({
      code: 'PROVIDER_LIST_CONTRACT_MISMATCH',
    });
  });

  it('passes plan/execute/detach tickets and fingerprints exactly', async () => {
    mockInvoke.mockResolvedValue({});
    const plan = { profileId: 'profile-a', providerId: 'company-proxy', selectedModel: 'model-a' };
    const execute = { planId: 'plan-1', fingerprint: 'fingerprint-1' };
    await planAttachProviderV2(plan);
    await executeAttachProviderV2(execute);
    await listProfileProviderBindingsV2();
    await planDetachProviderV2('profile-a');
    await executeDetachProviderV2(execute);
    expect(mockInvoke.mock.calls).toEqual([
      ['plan_attach_provider_v2', { req: plan }],
      ['execute_attach_provider_v2', { req: execute }],
      ['list_profile_provider_bindings_v2'],
      ['plan_detach_provider_v2', { profileId: 'profile-a' }],
      ['execute_detach_provider_v2', { req: execute }],
    ]);
  });

  it('uses the independent redacted upstream-test command', async () => {
    mockInvoke.mockResolvedValue({});
    await testProviderUpstreamV2('company-proxy');
    expect(mockInvoke).toHaveBeenCalledWith('test_provider_upstream_v2', {
      providerId: 'company-proxy',
    });
  });

  it('passes model discovery credentials only to the write-only command request', async () => {
    mockInvoke.mockResolvedValue({ models: [{ id: 'model-a', label: 'model-a' }] });
    const discovery = {
      baseUrl: 'https://proxy.example.test/v1',
      apiKey: 'synthetic-write-only-key',
    };
    await discoverProviderModelsV2(discovery);
    expect(mockInvoke).toHaveBeenCalledWith('discover_provider_models_v2', { req: discovery });
  });

  it('passes a Keychain secret only to the dedicated rotation request', async () => {
    mockInvoke.mockResolvedValue({});
    const rotation = {
      expectedRevision: 1,
      providerId: 'company-proxy',
      expectedCredential: { kind: 'env' as const, envKey: 'COMPANY_TOKEN' },
      secret: 'synthetic-input-only',
    };
    await rotateProviderCredentialV2(rotation);
    expect(mockInvoke).toHaveBeenCalledWith('rotate_provider_credential_v2', { req: rotation });
  });

  it('passes new Keychain secrets only to the atomic create command', async () => {
    mockInvoke.mockResolvedValue({});
    const keychainCreate = {
      ...request,
      provider: {
        ...request.provider,
        upstreamAuth: {
          kind: 'bearer' as const,
          credential: { kind: 'none' as const },
        },
      },
      secret: 'synthetic-create-input-only',
    };
    await createProviderWithKeychainV2(keychainCreate);
    expect(mockInvoke).toHaveBeenCalledWith('create_provider_with_keychain_v2', {
      req: keychainCreate,
    });
  });

  it('contains no secret field in the V2 request/view contract', () => {
    expect(JSON.stringify(request)).not.toContain('secret');
    expect(JSON.stringify(request)).not.toContain('env_key');
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  appTargetLabel,
  switchAppToAccount,
  switchAppToProvider,
  type AppTargetActions,
} from './app-target';
import type { AppTarget } from './types';

const accountTarget: AppTarget = { kind: 'account', accountId: 'work', providerId: null };
const providerTarget: AppTarget = { kind: 'provider', accountId: null, providerId: 'account-pro' };
const customTarget: AppTarget = {
  kind: 'customProvider',
  accountId: null,
  providerId: 'my-proxy',
};

function actions(overrides: Partial<AppTargetActions> = {}): AppTargetActions {
  return {
    confirm: vi.fn(async () => true),
    planDetach: vi.fn(async () => ({ planId: 'detach-1', fingerprint: 'fp-d' })),
    executeDetach: vi.fn(async () => undefined),
    planAttach: vi.fn(async () => ({ planId: 'attach-1', fingerprint: 'fp-a', blockers: [] })),
    executeAttach: vi.fn(async () => undefined),
    switchAccount: vi.fn(async () => undefined),
    ...overrides,
  };
}

function callOrder(deps: AppTargetActions, name: keyof AppTargetActions): number {
  return vi.mocked(deps[name]).mock.invocationCallOrder[0];
}

describe('appTargetLabel', () => {
  const accounts = [{ id: 'work', displayName: 'Work' }];
  const providers = [{ id: 'account-pro', name: 'pro API connection' }];

  it('names the account, connection or hand-written provider the Codex App runs on', () => {
    expect(appTargetLabel(accountTarget, accounts, providers)).toBe('Work');
    expect(appTargetLabel({ ...accountTarget, accountId: null }, accounts, providers)).toBe(
      'Not signed in',
    );
    expect(appTargetLabel(providerTarget, accounts, providers)).toBe(
      'pro API connection (External API)',
    );
    expect(appTargetLabel(customTarget, accounts, providers)).toBe('my-proxy (config.toml)');
    expect(appTargetLabel(null, accounts, providers)).toBeNull();
  });
});

describe('switchAppToAccount', () => {
  const account = { id: 'b', displayName: 'Account B' };

  it('switches directly when the Codex App already runs on an account', async () => {
    const deps = actions();

    await expect(switchAppToAccount(accountTarget, account, 'Work', deps)).resolves.toBe(true);

    expect(deps.switchAccount).toHaveBeenCalledWith('b');
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(deps.planDetach).not.toHaveBeenCalled();
  });

  it('confirms, detaches the connection from main, then switches', async () => {
    const deps = actions();

    await expect(
      switchAppToAccount(providerTarget, account, 'pro API connection', deps),
    ).resolves.toBe(true);

    expect(vi.mocked(deps.confirm).mock.calls[0][0]).toMatch(/pro API connection/);
    expect(vi.mocked(deps.confirm).mock.calls[0][0]).toMatch(/read-only/);
    expect(deps.planDetach).toHaveBeenCalledWith('main');
    expect(deps.executeDetach).toHaveBeenCalledWith({ planId: 'detach-1', fingerprint: 'fp-d' });
    expect(deps.switchAccount).toHaveBeenCalledWith('b');
    expect(callOrder(deps, 'executeDetach')).toBeLessThan(callOrder(deps, 'switchAccount'));
  });

  it('changes nothing when the user cancels', async () => {
    const deps = actions({ confirm: vi.fn(async () => false) });

    await expect(switchAppToAccount(providerTarget, account, 'pro', deps)).resolves.toBe(false);

    expect(deps.planDetach).not.toHaveBeenCalled();
    expect(deps.switchAccount).not.toHaveBeenCalled();
  });

  it('does not switch when detaching fails', async () => {
    const deps = actions({ executeDetach: vi.fn(async () => Promise.reject(new Error('drift'))) });

    await expect(switchAppToAccount(providerTarget, account, 'pro', deps)).rejects.toThrow('drift');
    expect(deps.switchAccount).not.toHaveBeenCalled();
  });

  it('explains the App is back on OpenAI when the switch fails after detaching', async () => {
    const deps = actions({ switchAccount: vi.fn(async () => Promise.reject(new Error('boom'))) });

    await expect(switchAppToAccount(providerTarget, account, 'pro', deps)).rejects.toThrow(
      /back on OpenAI.*boom/,
    );
  });

  it('refuses a hand-written provider without writing anything', async () => {
    const deps = actions();

    await expect(switchAppToAccount(customTarget, account, 'my-proxy', deps)).rejects.toThrow(
      /config\.toml/,
    );
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(deps.planDetach).not.toHaveBeenCalled();
    expect(deps.switchAccount).not.toHaveBeenCalled();
  });
});

describe('switchAppToProvider', () => {
  const connection = { providerId: 'account-pro', model: 'gpt-5', name: 'pro API connection' };

  it('confirms the read-only impact, then attaches the connection to main', async () => {
    const deps = actions();

    await expect(switchAppToProvider(accountTarget, connection, deps)).resolves.toBe(true);

    expect(vi.mocked(deps.confirm).mock.calls[0][0]).toMatch(/read-only/);
    expect(deps.planAttach).toHaveBeenCalledWith({
      profileId: 'main',
      providerId: 'account-pro',
      selectedModel: 'gpt-5',
    });
    expect(deps.executeAttach).toHaveBeenCalledWith({ planId: 'attach-1', fingerprint: 'fp-a' });
  });

  it('changes nothing when the user cancels', async () => {
    const deps = actions({ confirm: vi.fn(async () => false) });

    await expect(switchAppToProvider(accountTarget, connection, deps)).resolves.toBe(false);

    expect(deps.planAttach).not.toHaveBeenCalled();
  });

  it('stops before attaching when the plan is blocked', async () => {
    const deps = actions({
      planAttach: vi.fn(async () => ({
        planId: 'attach-1',
        fingerprint: 'fp-a',
        blockers: ['credential missing'],
      })),
    });

    await expect(switchAppToProvider(accountTarget, connection, deps)).rejects.toThrow(
      /credential missing/,
    );
    expect(deps.executeAttach).not.toHaveBeenCalled();
  });

  it('does nothing when the Codex App already uses the connection', async () => {
    const deps = actions();

    await expect(switchAppToProvider(providerTarget, connection, deps)).resolves.toBe(false);

    expect(deps.confirm).not.toHaveBeenCalled();
    expect(deps.planAttach).not.toHaveBeenCalled();
  });

  it('refuses a hand-written provider without writing anything', async () => {
    const deps = actions();

    await expect(switchAppToProvider(customTarget, connection, deps)).rejects.toThrow(
      /config\.toml/,
    );
    expect(deps.planAttach).not.toHaveBeenCalled();
  });
});

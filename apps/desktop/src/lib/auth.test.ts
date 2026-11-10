import { describe, expect, it } from 'vitest';
import { authModeLabel, codexAppSwitchBlocker } from './auth';

describe('codexAppSwitchBlocker', () => {
  const account = { id: 'work', hasAuth: true, authMode: 'oauth' };
  const free = { isActive: false, isApiAccount: false };

  it('lets a signed-in ChatGPT account take over the Codex App', () => {
    expect(codexAppSwitchBlocker(account, free)).toBeNull();
  });

  it('explains every account that cannot take over the Codex App', () => {
    expect(codexAppSwitchBlocker({ ...account, id: 'main' }, free)).toMatch(/main profile/i);
    expect(codexAppSwitchBlocker(account, { ...free, isActive: true })).toMatch(/already uses/i);
    expect(codexAppSwitchBlocker(account, { ...free, isApiAccount: true })).toMatch(
      /external api/i,
    );
    expect(codexAppSwitchBlocker({ ...account, hasAuth: false }, free)).toMatch(/log in/i);
    expect(codexAppSwitchBlocker({ ...account, authMode: 'api_key' }, free)).toMatch(/api key/i);
  });
});

describe('authModeLabel', () => {
  it('keeps user-facing auth labels consistent across account surfaces', () => {
    expect(authModeLabel('personal_token')).toBe('PAT');
    expect(authModeLabel('uploaded')).toBe('Uploaded');
    expect(authModeLabel('oauth')).toBe('Auth');
    expect(authModeLabel('api_key')).toBe('Auth');
    expect(authModeLabel('config')).toBe('Auth');
  });

  it('hides absent auth modes', () => {
    expect(authModeLabel(null)).toBeNull();
    expect(authModeLabel(undefined)).toBeNull();
    expect(authModeLabel('')).toBeNull();
  });
});

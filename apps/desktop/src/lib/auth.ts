import type { AppTarget } from './types';

/** Why an account cannot take over the Codex App in PAT mode, or null when it can. */
export function codexAppSwitchBlocker(
  account: { id: string; hasAuth: boolean; authMode?: string | null },
  {
    isActive,
    isApiAccount,
    appTarget,
  }: { isActive: boolean; isApiAccount: boolean; appTarget?: AppTarget | null },
): string | null {
  if (account.id === 'main') return "The main profile is the Codex App's own sign-in";
  if (appTarget?.kind === 'customProvider')
    return `Codex App uses the '${appTarget.providerId}' provider from ~/.codex/config.toml; remove it there first`;
  if (isActive && appTarget?.kind !== 'provider') return 'Codex App already uses this account';
  if (isApiAccount) return 'External API accounts connect through their provider';
  if (!account.hasAuth) return 'Log in to this account first';
  if (account.authMode === 'api_key') return 'API key accounts can only be used from the CLI';
  return null;
}

export function authModeLabel(authMode?: string | null): string | null {
  if (!authMode) return null;
  if (authMode === 'personal_token') return 'PAT';
  if (authMode === 'uploaded') return 'Uploaded';
  return 'Auth';
}

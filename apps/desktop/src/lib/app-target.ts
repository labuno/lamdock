import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
import {
  executeAttachProviderV2,
  executeDetachProviderV2,
  inTauri,
  planAttachProviderV2,
  planDetachProviderV2,
  switchToPatAccount,
} from './api';
import { formatError } from './format';
import type { AppTarget, ExecuteAttachRequestV2, PlanAttachRequestV2 } from './types';

const APP_PROFILE_ID = 'main';

type PlanHandle = { planId: string; fingerprint: string };

export type AppTargetActions = {
  confirm(message: string, title: string): Promise<boolean>;
  planDetach(profileId: string): Promise<PlanHandle>;
  executeDetach(req: ExecuteAttachRequestV2): Promise<unknown>;
  planAttach(req: PlanAttachRequestV2): Promise<PlanHandle & { blockers: string[] }>;
  executeAttach(req: ExecuteAttachRequestV2): Promise<unknown>;
  switchAccount(accountId: string): Promise<void>;
};

async function confirmDialog(message: string, title: string): Promise<boolean> {
  if (inTauri()) {
    try {
      return await tauriConfirm(message, { title, kind: 'warning' });
    } catch (err) {
      console.warn('Tauri confirm dialog failed; falling back to window.confirm', err);
    }
  }
  return window.confirm(message);
}

export function defaultAppTargetActions(): AppTargetActions {
  return {
    confirm: confirmDialog,
    planDetach: planDetachProviderV2,
    executeDetach: executeDetachProviderV2,
    planAttach: planAttachProviderV2,
    executeAttach: executeAttachProviderV2,
    switchAccount: switchToPatAccount,
  };
}

export function appTargetLabel(
  target: AppTarget | null,
  accounts: Array<{ id: string; displayName: string }>,
  providers: Array<{ id: string; name: string }>,
): string | null {
  if (!target) return null;
  if (target.kind === 'customProvider') return `${target.providerId} (config.toml)`;
  if (target.kind === 'provider') {
    const name = providers.find((p) => p.id === target.providerId)?.name ?? target.providerId;
    return `${name} (External API)`;
  }
  if (!target.accountId) return 'Not signed in';
  return accounts.find((a) => a.id === target.accountId)?.displayName ?? target.accountId;
}

function customProviderError(target: AppTarget): Error {
  return new Error(
    `Codex App uses the '${target.providerId}' provider set in ~/.codex/config.toml; remove it there first`,
  );
}

/** Resolves false when the user cancels; nothing is written in that case. */
export async function switchAppToAccount(
  target: AppTarget | null,
  account: { id: string; displayName: string },
  connectionName: string,
  deps: AppTargetActions,
): Promise<boolean> {
  if (target?.kind === 'customProvider') throw customProviderError(target);
  if (target?.kind !== 'provider') {
    await deps.switchAccount(account.id);
    return true;
  }

  const confirmed = await deps.confirm(
    `Codex App is using the "${connectionName}" connection. Detach it and switch to ${account.displayName}? Chats started on that connection become read-only in the Codex App until you attach it again.`,
    'Switch Codex App Account',
  );
  if (!confirmed) return false;

  const plan = await deps.planDetach(APP_PROFILE_ID);
  await deps.executeDetach({ planId: plan.planId, fingerprint: plan.fingerprint });
  const switchError = await deps.switchAccount(account.id).then(
    () => null,
    (err: unknown) => err,
  );
  if (switchError !== null) {
    throw new Error(
      `Codex App is back on OpenAI, but switching to ${account.displayName} failed: ${formatError(switchError)}`,
    );
  }
  return true;
}

/** Resolves false when the user cancels or the App already uses the connection. */
export async function switchAppToProvider(
  target: AppTarget | null,
  connection: { providerId: string; model: string; name: string },
  deps: AppTargetActions,
): Promise<boolean> {
  if (target?.kind === 'customProvider') throw customProviderError(target);
  if (target?.kind === 'provider' && target.providerId === connection.providerId) return false;

  const confirmed = await deps.confirm(
    `Let the Codex App use the "${connection.name}" connection? Chats started on other accounts or connections become read-only in the Codex App until you switch back.`,
    'Use in Codex App',
  );
  if (!confirmed) return false;

  const plan = await deps.planAttach({
    profileId: APP_PROFILE_ID,
    providerId: connection.providerId,
    selectedModel: connection.model,
  });
  if (plan.blockers.length) throw new Error(plan.blockers.join('; '));
  await deps.executeAttach({ planId: plan.planId, fingerprint: plan.fingerprint });
  return true;
}

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Accounts } from './views';
import type { CodexAccount } from '../lib/types';

const account: CodexAccount = {
  id: 'main',
  displayName: 'main',
  codexHome: '/tmp/.codex',
  hasAuth: true,
  hasConfig: true,
  hasHistory: false,
  sessionCount: 0,
  managed: false,
  isRelay: false,
};
function props() {
  return {
    accounts: [account],
    quotas: [],
    select: vi.fn(),
    rename: vi.fn(),
    deleteAccount: vi.fn(),
    login: vi.fn(),
    switchAccount: vi.fn(),
    exportCpa: vi.fn(),
    openHandoff: vi.fn(),
    relayLatest: vi.fn(),
    refreshAccountQuota: vi.fn(),
    refreshingQuotaIds: [],
    onSaveAccountNote: vi.fn(),
    onSaveAccountProxy: vi.fn().mockResolvedValue(undefined),
  };
}

describe('proxy controls in account cards', () => {
  it('opens the main account proxy editor from its menu and keeps it open while typing', () => {
    render(<Accounts {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enable Proxy' }));
    fireEvent.click(screen.getByLabelText('Proxy address'));
    fireEvent.change(screen.getByLabelText('Proxy address'), {
      target: { value: 'http://127.0.0.1:17891' },
    });
    expect(screen.getByLabelText('Proxy address')).toHaveValue('http://127.0.0.1:17891');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/restart/i)).toBeTruthy();
  });
  it('shows PROXY with the auth badges and removes it when disabled', () => {
    const setup = props();
    const enabled = { ...account, proxy: { enabled: true, url: 'http://127.0.0.1:17892' } };
    const { rerender } = render(<Accounts {...setup} accounts={[enabled]} />);
    expect(screen.getByText('PROXY').closest('.cardTagsRow')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('button', { name: 'Edit Proxy' })).toBeTruthy();
    rerender(
      <Accounts
        {...setup}
        accounts={[{ ...enabled, proxy: { ...enabled.proxy, enabled: false } }]}
      />,
    );
    expect(screen.queryByText('PROXY')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Proxy' })).toBeNull();
  });
  it('keeps proxy settings available with expanded actions', () => {
    render(<Accounts {...props()} compactButtons={false} />);
    expect(screen.getByRole('button', { name: 'Enable Proxy' })).toBeTruthy();
  });
  it('does not advertise unsupported external API proxy settings', () => {
    render(<Accounts {...props()} apiAccountIds={['main']} />);
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.queryByRole('button', { name: 'Enable Proxy' })).toBeNull();
  });
});

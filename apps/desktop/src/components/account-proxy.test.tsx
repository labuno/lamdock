import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountProxyActions, AccountProxyBadge } from './account-proxy';
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

describe('account proxy controls', () => {
  it('hides disabled badges and only shows Enable Proxy', () => {
    render(
      <>
        <AccountProxyBadge proxy={{ enabled: false, url: 'http://localhost:17891' }} />
        <AccountProxyActions account={account} onSave={vi.fn()} />
      </>,
    );
    expect(screen.queryByText('PROXY')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Proxy' })).toBeNull();
    expect(screen.queryByLabelText('Proxy address')).toBeNull();
    expect(screen.getByRole('button', { name: 'Enable Proxy' })).toBeTruthy();
  });

  it('enables main, pre-fills the retained address and saves once', async () => {
    const save = vi.fn(() => new Promise<void>(() => {}));
    render(
      <AccountProxyActions
        account={{ ...account, proxy: { enabled: false, url: 'http://localhost:17891' } }}
        onSave={save}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enable Proxy' }));
    expect(screen.getByLabelText('Proxy address')).toHaveValue('http://localhost:17891');
    fireEvent.change(screen.getByLabelText('Proxy address'), {
      target: { value: 'http://127.0.0.1:17892' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(save).toHaveBeenCalledWith({
      profileId: 'main',
      enabled: true,
      url: 'http://127.0.0.1:17892',
    });
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Saving...' }));
    expect(save).toHaveBeenCalledOnce();
  });

  it('shows a green configured badge with address tooltip and supports editing/disable', async () => {
    const proxy = { enabled: true, url: 'http://127.0.0.1:17891' };
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <>
        <AccountProxyBadge proxy={proxy} />
        <AccountProxyActions account={{ ...account, proxy }} onSave={save} />
      </>,
    );
    const badge = screen.getByText('PROXY');
    expect(badge).toHaveClass('badge--auth');
    expect(badge).toHaveAttribute('title', proxy.url);
    expect(badge).toHaveAttribute('tabindex', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Proxy' }));
    expect(screen.getByLabelText('Proxy address')).toHaveValue(proxy.url);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Disable Proxy' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ profileId: 'main', enabled: false, url: proxy.url }),
    );
  });

  it('keeps failed edits visible and does not claim success', async () => {
    const save = vi.fn().mockRejectedValue({ message: 'Invalid proxy address' });
    render(<AccountProxyActions account={account} onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enable Proxy' }));
    fireEvent.change(screen.getByLabelText('Proxy address'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid proxy address');
    expect(screen.getByLabelText('Proxy address')).toHaveValue('wrong');
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });
});

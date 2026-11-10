import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BottomNav } from './shell';

it('renders all five routes as integrated vector controls and marks the active page', () => {
  const setRoute = vi.fn();
  render(<BottomNav route="sessions" setRoute={setRoute} />);
  const nav = screen.getByRole('navigation', { name: 'Primary' });
  expect(within(nav).getAllByRole('button')).toHaveLength(5);
  for (const name of ['Overview', 'Sessions', 'Providers', 'Monitor', 'Settings']) {
    const button = within(nav).getByRole('button', { name });
    expect(button.querySelector('svg')).toBeTruthy();
    expect(button.querySelector('img')).toBeNull();
  }
  expect(within(nav).getByRole('button', { name: 'Sessions' }).getAttribute('aria-current')).toBe(
    'page',
  );
  expect(nav.querySelector('.bottomNavSelectionDot')).toBeTruthy();
  expect(within(nav).queryByRole('button', { name: 'Usage' })).toBeNull();
  fireEvent.click(within(nav).getByRole('button', { name: 'Providers' }));
  expect(setRoute).toHaveBeenCalledWith('providers');
});

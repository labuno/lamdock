import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { NavIcon } from './icons';

it('uses route and gear silhouettes for the Providers and Settings navigation', () => {
  const { container, rerender } = render(<NavIcon name="settings" />);
  expect(container.querySelector('path')?.getAttribute('d')).toContain('19.4');
  rerender(<NavIcon name="providers" />);
  expect(container.querySelectorAll('circle')).toHaveLength(4);
});

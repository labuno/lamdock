import type { NavIconName } from '../components/icons';

export type Route = 'overview' | 'sessions' | 'providers' | 'monitor' | 'settings';

export const routes: Array<{ id: Route; label: string; icon: NavIconName }> = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'sessions', label: 'Sessions', icon: 'sessions' },
  { id: 'providers', label: 'Providers', icon: 'providers' },
  { id: 'monitor', label: 'Monitor', icon: 'monitor' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function routeTitle(route: Route) {
  return routes.find((item) => item.id === route)?.label ?? route;
}

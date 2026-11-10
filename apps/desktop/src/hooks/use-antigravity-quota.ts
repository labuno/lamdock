import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/api';
import type { AntigravityQuotaResponse } from '../lib/types';

export function useAntigravityQuota(configuredPort?: number | null, enabled = true) {
  const [quota, setQuota] = useState<AntigravityQuotaResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef<{ cancelled: boolean } | null>(null);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!enabled || !api.inTauri() || inFlight.current) return;
      const request = { cancelled: false };
      inFlight.current = request;
      try {
        if (forceRefresh) setRefreshing(true);
        const response = await api.getAntigravityQuota();
        if (!request.cancelled) setQuota(response);
      } catch (error) {
        if (!request.cancelled) console.error('Failed to load Antigravity quota:', error);
      } finally {
        if (inFlight.current === request) {
          inFlight.current = null;
          setRefreshing(false);
        }
      }
    },
    [enabled],
  );

  /* eslint-disable react-hooks/set-state-in-effect -- async load on configuration changes */
  useEffect(() => {
    setQuota(null);
    setRefreshing(false);
    if (!enabled) return;
    void load();
    const timer = window.setInterval(() => {
      void load(true);
    }, 2 * 60_000);
    return () => {
      window.clearInterval(timer);
      if (inFlight.current) inFlight.current.cancelled = true;
      inFlight.current = null;
    };
  }, [load, configuredPort, enabled]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { quota, refreshing, load };
}

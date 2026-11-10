import { useCallback, useEffect, useRef, useState } from 'react';
import { queryRequestMonitor } from '../lib/api';
import { formatError } from '../lib/format';
import {
  activityDays,
  durationLabel,
  filterRequests,
  monitorSummary,
  requestSucceeded,
} from '../lib/request-monitor';
import type { MonitorFilters } from '../lib/request-monitor';
import type { MonitoredRequest, RequestMonitorSnapshot } from '../lib/types';
import { IconActivity, IconRefresh } from '../components/icons';
import { UIButton } from '../components/ui-button';

const PAGE_SIZE = 50;

function useMonitor(auto: boolean) {
  const [snapshot, setSnapshot] = useState<RequestMonitorSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const load = useCallback(() => {
    const request = ++sequence.current;
    return queryRequestMonitor()
      .then((next) => {
        if (request !== sequence.current) return;
        setSnapshot(next);
        setError('');
      })
      .catch((err) => {
        if (request === sequence.current) setError(formatError(err));
      })
      .finally(() => {
        if (request === sequence.current) setLoading(false);
      });
  }, []);
  const refresh = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);
  const invalidate = useCallback(() => {
    sequence.current++;
  }, []);
  useEffect(() => {
    void load();
    return invalidate;
  }, [load, invalidate]);
  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [auto, refresh]);
  return { snapshot, error, loading, refresh };
}

export function RequestMonitor() {
  const [auto, setAuto] = useState(true);
  const [filters, setFilters] = useState<MonitorFilters>({
    days: 30,
    provider: '',
    model: '',
    result: '',
  });
  const [page, setPage] = useState(0);
  const { snapshot, error, loading, refresh } = useMonitor(auto);
  const records = snapshot
    ? filterRequests(snapshot.records, filters, new Date(snapshot.readAt))
    : [];
  const changeFilter = (patch: Partial<MonitorFilters>) => {
    setFilters((value) => ({ ...value, ...patch }));
    setPage(0);
  };
  const lastPage = Math.max(0, Math.ceil(records.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  return (
    <section className="requestMonitor" aria-label="Request monitor">
      <div className="monitorHeading">
        <div>
          <h3>
            <IconActivity size={19} /> Request monitor
          </h3>
          <p>Direct observations of requests routed through LamDock.</p>
        </div>
        <div className="monitorActions">
          <label>
            <input
              type="checkbox"
              checked={auto}
              onChange={(event) => setAuto(event.target.checked)}
            />{' '}
            Auto · 10s
          </label>
          <UIButton size="sm" aria-label="Refresh monitor" onClick={() => void refresh()}>
            <IconRefresh size={14} /> Refresh
          </UIButton>
        </div>
      </div>
      <div className="monitorCoverage">
        <strong>
          <span className="monitorDot" /> Gateway traffic only · Codex
        </strong>
        <span>
          Official Codex / native Responses direct: not connected. Claude / Pi: not connected.
        </span>
      </div>
      <MonitorFiltersBar snapshot={snapshot} filters={filters} onChange={changeFilter} />
      {error && (
        <p role="alert" className="monitorError">
          {error}
          {snapshot ? ' Showing the last successful read.' : ''}
        </p>
      )}
      {loading && !snapshot && (
        <p role="status" className="monitorEmpty">
          Loading recorded requests…
        </p>
      )}
      {snapshot && (
        <>
          <MonitorSummary records={records} />
          <ActivityStrip records={records} days={filters.days} now={new Date(snapshot.readAt)} />
          <div className="monitorLogHeader">
            <h4>
              Request log <span>{records.length.toLocaleString()}</span>
            </h4>
            <span>
              {loading
                ? 'Refreshing…'
                : `Read at ${new Date(snapshot.readAt).toLocaleTimeString()}`}
            </span>
          </div>
          {records.length ? (
            <RequestTable
              records={records.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)}
              snapshot={snapshot}
            />
          ) : (
            <p className="monitorEmpty">No recorded requests in this view.</p>
          )}
          {records.length > PAGE_SIZE && (
            <div className="monitorPagination">
              <UIButton
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </UIButton>
              <span>
                {currentPage + 1} / {lastPage + 1}
              </span>
              <UIButton
                size="sm"
                disabled={currentPage === lastPage}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </UIButton>
            </div>
          )}
          <MonitorNotes snapshot={snapshot} />
        </>
      )}
    </section>
  );
}

function MonitorFiltersBar({
  snapshot,
  filters,
  onChange,
}: {
  snapshot: RequestMonitorSnapshot | null;
  filters: MonitorFilters;
  onChange: (patch: Partial<MonitorFilters>) => void;
}) {
  const models = [
    ...new Set(snapshot?.records.flatMap((record) => (record.model ? [record.model] : [])) ?? []),
  ].sort();
  const providers = [...new Set(snapshot?.records.map((record) => record.providerHash) ?? [])];
  return (
    <div className="monitorFilters">
      <label>
        Period
        <select
          aria-label="Period"
          value={filters.days}
          onChange={(e) => onChange({ days: Number(e.target.value) })}
        >
          <option value={1}>Today</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </label>
      <label>
        Provider
        <select
          aria-label="Provider"
          value={filters.provider}
          onChange={(e) => onChange({ provider: e.target.value })}
        >
          <option value="">All providers</option>
          {providers.map((id) => (
            <option key={id} value={id}>
              {snapshot?.providerNames[id] ?? `Unknown · ${id.slice(0, 6)}`}
            </option>
          ))}
        </select>
      </label>
      <label>
        Model
        <select
          aria-label="Model"
          value={filters.model}
          onChange={(e) => onChange({ model: e.target.value })}
        >
          <option value="">All models</option>
          {models.map((model) => (
            <option key={model}>{model}</option>
          ))}
        </select>
      </label>
      <label>
        Result
        <select
          aria-label="Result"
          value={filters.result}
          onChange={(e) => onChange({ result: e.target.value as MonitorFilters['result'] })}
        >
          <option value="">All results</option>
          <option value="success">Success</option>
          <option value="error">Other results</option>
        </select>
      </label>
    </div>
  );
}

function MonitorSummary({ records }: { records: MonitoredRequest[] }) {
  const summary = monitorSummary(records);
  return (
    <div className="monitorSummary">
      <div>
        <span>Recorded requests</span>
        <strong>{records.length.toLocaleString()}</strong>
        <small>In this view · completed observations</small>
      </div>
      <div>
        <span>Cache hit rate</span>
        <strong>
          {summary.cacheRate == null ? '—' : `${(summary.cacheRate * 100).toFixed(1)}%`}
        </strong>
        <small>
          {summary.cacheSamples} of {records.length} requests · cached / input
        </small>
      </div>
      <div title="From gateway dispatch to its first nonempty text, reasoning or tool argument delta. Includes queue and retries. Headers and heartbeats are excluded.">
        <span>First content · median</span>
        <strong>{durationLabel(summary.firstContentMs)}</strong>
        <small>{summary.firstContentSamples} measured requests · gateway elapsed</small>
      </div>
    </div>
  );
}

function ActivityStrip({
  records,
  days,
  now,
}: {
  records: MonitoredRequest[];
  days: number;
  now: Date;
}) {
  const activity = activityDays(records, days, now);
  const max = Math.max(1, ...activity.map((day) => day.count));
  return (
    <div className="monitorActivity">
      <div className="monitorLogHeader">
        <h4>Recorded activity</h4>
        <span>Request start · local time</span>
      </div>
      <div
        className="monitorHeatmap"
        role="img"
        aria-label="Recorded requests by day. Empty days have unknown coverage."
      >
        {activity.map((day) => (
          <span
            key={day.date}
            title={day.label}
            data-level={day.count ? Math.max(1, Math.ceil((day.count / max) * 4)) : 0}
          />
        ))}
      </div>
      <div className="monitorActivityLegend">
        <span>{activity[0].date}</span>
        <span>Empty = no recorded requests; coverage unknown</span>
        <span>{activity[activity.length - 1].date}</span>
      </div>
    </div>
  );
}

function RequestTable({
  records,
  snapshot,
}: {
  records: MonitoredRequest[];
  snapshot: RequestMonitorSnapshot;
}) {
  const count = (value: number | null | undefined) =>
    value == null ? '—' : value.toLocaleString();
  return (
    <div className="monitorTableScroll">
      <table className="monitorTable">
        <thead>
          <tr>
            <th>Time / source</th>
            <th>Account / provider</th>
            <th>Model</th>
            <th>Result</th>
            <th>Input / cached</th>
            <th>Output</th>
            <th>First content</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.recordId}>
              <td title={record.requestId}>
                <time dateTime={record.startedAt}>
                  {new Date(record.startedAt).toLocaleString(undefined, {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
                <small>Codex · Gateway</small>
              </td>
              <td>
                <span>
                  {record.profileHash
                    ? (snapshot.profileNames[record.profileHash] ??
                      `Unknown · ${record.profileHash.slice(0, 6)}`)
                    : '—'}
                </span>
                <small>
                  {snapshot.providerNames[record.providerHash] ??
                    `Unknown · ${record.providerHash.slice(0, 6)}`}
                </small>
              </td>
              <td className="mono">{record.model ?? '—'}</td>
              <td title={record.outcomeCode ?? undefined}>
                <span
                  className={`monitorResult ${record.streamState === 'unverified' ? 'unknown' : requestSucceeded(record) ? 'success' : 'error'}`}
                >
                  {record.status}{' '}
                  {record.streamState ?? (requestSucceeded(record) ? 'OK' : 'error')}
                </span>
                {record.retryCount > 0 && (
                  <small>{record.retryCount} retries · final attempt usage</small>
                )}
              </td>
              <td className="mono">
                {count(record.usage?.inputTokens)}
                <small>{count(record.usage?.cachedInputTokens)} cached</small>
              </td>
              <td className="mono">
                {count(record.usage?.outputTokens)}
                {record.usage?.reasoningOutputTokens != null && (
                  <small>{count(record.usage.reasoningOutputTokens)} reasoning</small>
                )}
              </td>
              <td className="mono">{durationLabel(record.ttftMs)}</td>
              <td className="mono">{durationLabel(record.latencyMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonitorNotes({ snapshot }: { snapshot: RequestMonitorSnapshot }) {
  return (
    <div className="monitorNotes">
      <p>
        Only saved gateway requests are included, up to {snapshot.recordLimit.toLocaleString()}{' '}
        recent records. — means unknown. Unobserved traffic is outside this view.
      </p>
      <p>
        Usage comes from upstream responses. Cached input and reasoning output are subsets. Cache
        rate excludes retries and requests missing input, output or cache fields. First content is
        measured only for supported streaming deltas.
      </p>
      {snapshot.legacyRecords > 0 && (
        <p>
          {snapshot.legacyRecords} legacy records excluded: their timing and usage are not verified
          for this monitor.
        </p>
      )}
      {(snapshot.truncated || snapshot.invalidRecords > 0) && (
        <p className="monitorWarning">
          Partial log view: {snapshot.truncated ? 'older records are outside the read limit. ' : ''}
          {snapshot.invalidRecords > 0
            ? `${snapshot.invalidRecords} unreadable records excluded.`
            : ''}
        </p>
      )}
      {snapshot.pendingLine && (
        <p>A request record is being written; refresh to read it when complete.</p>
      )}
    </div>
  );
}

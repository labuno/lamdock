import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../lib/api';
import type { CodexSession, SessionPage } from '../lib/types';
import { useAppStore } from './app';
import { useSessionStore } from './sessions';

vi.mock('../lib/api', () => ({
  listSessionsPage: vi.fn(),
  querySessionsPage: vi.fn(),
  getSessionStorageSummary: vi.fn(),
  queryDeletableSessionPaths: vi.fn(),
  deleteSessions: vi.fn(),
  buildResumeCommand: vi.fn(),
  openTerminalWithResume: vi.fn(),
}));

function session(accountId: string, id: string, modifiedAt: number): CodexSession {
  return {
    id,
    accountId,
    path: `/tmp/${accountId}/${id}.jsonl`,
    modifiedAt,
    sizeBytes: 10,
    cwd: `/repo/${accountId}`,
    threadName: id,
    summary: null,
    firstUserMessage: null,
    model: null,
    originalProviderId: null,
    originalModel: null,
    currentProviderId: null,
    currentModel: null,
    providerMismatch: false,
  };
}

function page(items: CodexSession[], nextCursor: SessionPage['nextCursor'] = null): SessionPage {
  return { items, nextCursor };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ error: '', status: 'Ready' });
  useSessionStore.setState({
    sessions: [],
    selectedSessionId: '',
    query: '',
    resume: null,
    loadedAccountId: '',
    sort: 'newest',
    ageFilter: 'all',
    deletableOnly: false,
    mutationRunning: false,
  });
});

describe('useSessionStore pagination', () => {
  it('loads the latest 20 sessions and appends an older cursor page', async () => {
    const cursor = { modifiedAt: 20, path: '/tmp/main/sid-20.jsonl' };
    vi.mocked(api.querySessionsPage)
      .mockResolvedValueOnce(page([session('main', 'sid-1', 30)], cursor))
      .mockResolvedValueOnce(page([session('main', 'sid-2', 10)]));

    await useSessionStore.getState().loadSessions('main');
    expect(api.querySessionsPage).toHaveBeenNthCalledWith(1, 'main', {
      limit: 20,
      sort: 'newest',
      age: 'all',
    });
    expect(useSessionStore.getState().sessions.map((item) => item.id)).toEqual(['sid-1']);
    expect(useSessionStore.getState().hasMore).toBe(true);

    await useSessionStore.getState().loadMoreSessions();
    expect(api.querySessionsPage).toHaveBeenNthCalledWith(2, 'main', {
      limit: 20,
      cursor,
      sort: 'newest',
      age: 'all',
    });
    expect(useSessionStore.getState().sessions.map((item) => item.id)).toEqual(['sid-1', 'sid-2']);
    expect(useSessionStore.getState().hasMore).toBe(false);
  });

  it('ignores a stale page after switching accounts', async () => {
    const main = deferred<SessionPage>();
    const work = deferred<SessionPage>();
    vi.mocked(api.querySessionsPage)
      .mockReturnValueOnce(main.promise)
      .mockReturnValueOnce(work.promise);

    const mainLoad = useSessionStore.getState().loadSessions('main');
    const workLoad = useSessionStore.getState().loadSessions('work');
    work.resolve(page([session('work', 'work-latest', 2)]));
    await workLoad;
    main.resolve(page([session('main', 'main-latest', 1)]));
    await mainLoad;

    expect(useSessionStore.getState().sessions.map((item) => item.id)).toEqual(['work-latest']);
    expect(useSessionStore.getState().loadedAccountId).toBe('work');
  });

  it('reloads from page one when size sort or age filter changes', async () => {
    vi.mocked(api.querySessionsPage).mockResolvedValue(page([]));
    useSessionStore.setState({ loadedAccountId: 'main' });

    await useSessionStore.getState().setSort('largest');
    await useSessionStore.getState().setAgeFilter('olderThan30Days');

    expect(api.querySessionsPage).toHaveBeenNthCalledWith(1, 'main', {
      limit: 20,
      sort: 'largest',
      age: 'all',
    });
    expect(api.querySessionsPage).toHaveBeenNthCalledWith(2, 'main', {
      limit: 20,
      sort: 'largest',
      age: 'olderThan30Days',
    });
  });
});

describe('useSessionStore lifecycle management', () => {
  it('selects every deletable path for the current age and search filters', async () => {
    vi.mocked(api.queryDeletableSessionPaths).mockResolvedValue([
      '/tmp/main/old-a.jsonl',
      '/tmp/main/old-b.jsonl',
    ]);
    useSessionStore.setState({
      loadedAccountId: 'main',
      ageFilter: 'olderThan30Days',
      query: 'cleanup',
    });

    const paths = await useSessionStore.getState().selectAllFilteredSessions();

    expect(paths).toEqual(['/tmp/main/old-a.jsonl', '/tmp/main/old-b.jsonl']);
    expect(api.queryDeletableSessionPaths).toHaveBeenCalledWith('main', {
      age: 'olderThan30Days',
      query: 'cleanup',
    });
  });

  it('loads storage totals for an account', async () => {
    vi.mocked(api.getSessionStorageSummary).mockResolvedValue({
      evaluatedAt: 1_000,
      activeCount: 40,
      activeBytes: 4_000,
      eligibleCount: 12,
      eligibleBytes: 1_200,
      retainedRecentCount: 20,
      minimumAgeDays: 7,
    });

    await useSessionStore.getState().loadSessionManagement('main');

    expect(api.getSessionStorageSummary).toHaveBeenCalledWith('main');
    expect(useSessionStore.getState().storageSummary?.eligibleCount).toBe(12);
  });

  it('deletes selected paths and refreshes the session list and storage summary', async () => {
    vi.mocked(api.deleteSessions).mockResolvedValue({ deletedCount: 1, deletedBytes: 100 });
    vi.mocked(api.querySessionsPage).mockResolvedValue(page([]));
    vi.mocked(api.getSessionStorageSummary).mockResolvedValue({
      evaluatedAt: 1_000,
      activeCount: 0,
      activeBytes: 0,
      eligibleCount: 0,
      eligibleBytes: 0,
      retainedRecentCount: 20,
      minimumAgeDays: 7,
    });
    useSessionStore.setState({ loadedAccountId: 'main' });

    await useSessionStore.getState().deleteSelectedSessions(['/tmp/main/old.jsonl']);

    expect(api.deleteSessions).toHaveBeenCalledWith({
      profileId: 'main',
      paths: ['/tmp/main/old.jsonl'],
    });
    expect(useAppStore.getState().status).toContain('Deleted 1 session');
    expect(api.querySessionsPage).toHaveBeenCalledWith('main', {
      limit: 20,
      sort: 'newest',
      age: 'all',
    });
    expect(api.getSessionStorageSummary).toHaveBeenCalledWith('main');
  });

  it.each(['other', 'cleared'])(
    'preserves %s state when an earlier deletion completes',
    async (target) => {
      const pending = deferred<{ deletedCount: number; deletedBytes: number }>();
      vi.mocked(api.deleteSessions).mockReturnValue(pending.promise);
      vi.mocked(api.querySessionsPage).mockResolvedValue(page([session('other', 'latest', 2)]));
      useSessionStore.setState({ loadedAccountId: 'main' });

      const deletion = useSessionStore.getState().deleteSelectedSessions(['/tmp/main/old.jsonl']);
      if (target === 'cleared') useSessionStore.getState().clear();
      else await useSessionStore.getState().loadSessions('other');
      const current = useSessionStore.getState();
      vi.mocked(api.querySessionsPage).mockClear();
      pending.resolve({ deletedCount: 1, deletedBytes: 100 });
      await deletion;

      expect(useSessionStore.getState().loadedAccountId).toBe(current.loadedAccountId);
      expect(useSessionStore.getState().sessions).toEqual(current.sessions);
      expect(api.querySessionsPage).not.toHaveBeenCalled();
      expect(api.getSessionStorageSummary).not.toHaveBeenCalled();
    },
  );
});

it('queries deletable sessions before paging when the deletion filter changes', async () => {
  useSessionStore.setState({ loadedAccountId: 'main' });
  vi.mocked(api.querySessionsPage).mockResolvedValue(
    page([{ ...session('main', 'older', 1), deletable: true }]),
  );
  await useSessionStore.getState().setDeletableOnly(true);
  expect(api.querySessionsPage).toHaveBeenLastCalledWith(
    'main',
    expect.objectContaining({ deletableOnly: true, limit: 20 }),
  );
  expect(useSessionStore.getState().sessions[0].deletable).toBe(true);
});

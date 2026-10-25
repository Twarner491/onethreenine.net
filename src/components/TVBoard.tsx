import { useCallback, useEffect, useRef, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { createClient } from '@supabase/supabase-js';
import { PegboardCanvas } from './PegboardCanvas';
import type { Database } from '../lib/database.types';
import { createTVBoardSource, TVBoardSession, type TVState } from '../lib/tv-board-session';
import { fitTVViewport, retryFailedTVImages, TV_DESIGN_VIEWPORT, waitForTVAssets } from '../lib/tv-board-presentation';

const ignore = () => {};
const initialState: TVState = { snapshot: null, connection: 'connecting', error: null };
// Always use the site's public read access; never inherit a saved Supabase Auth session.
const tvClient = createClient<Database>(
  import.meta.env.PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

/** Dedicated display path. It never imports App's login, editing or demo-seeding flow. */
export default function TVBoard() {
  const [state, setState] = useState<TVState>(initialState);
  const [viewport, setViewport] = useState(() => fitTVViewport(1920, 1080));
  const [assetRetry, setAssetRetry] = useState(0);
  const artRef = useRef<HTMLDivElement>(null);
  const assetAttempts = useRef(0);
  const assetSnapshot = useRef<TVState['snapshot']>(null);
  const retryIncompleteAssets = useCallback((resetBudget: boolean) => {
    if (!artRef.current || document.hidden || !navigator.onLine ||
        document.documentElement.dataset.tvAssetsReady === 'true') return;
    if (resetBudget) assetAttempts.current = 0;
    if (assetAttempts.current >= 3) return;
    assetAttempts.current++;
    retryFailedTVImages(artRef.current);
    setAssetRetry(previous => previous + 1);
  }, []);

  useEffect(() => {
    const resize = () => {
      const next = fitTVViewport(window.innerWidth, window.innerHeight);
      setViewport(previous => next.scale === previous.scale && next.left === previous.left && next.top === previous.top ? previous : next);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* restricted browser storage */ }
    const session = new TVBoardSession(createTVBoardSource(tvClient), setState, storage);
    setState(session.getState());
    let changeTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { void session.refresh(); };
    const change = () => {
      // One snapshot per burst, including simultaneous item and author changes.
      if (!changeTimer) changeTimer = setTimeout(() => { changeTimer = undefined; refresh(); }, 200);
    };
    const online = () => { void session.setOnline(true); retryIncompleteAssets(true); };
    const offline = () => { void session.setOnline(false); };
    const resume = () => {
      if (!document.hidden) {
        void session.setOnline(navigator.onLine);
        retryIncompleteAssets(true);
      }
    };
    const channel = tvClient.channel('tv_board_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_items' }, change)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, change)
      .subscribe(status => {
        void session.setRealtimeConnected(status === 'SUBSCRIBED');
      });
    void session.setOnline(navigator.onLine);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('onethreenine:resume', resume);
    document.addEventListener('visibilitychange', resume);
    // Realtime owns healthy live updates. Only retry snapshots while disconnected.
    const poll = setInterval(() => { if (!document.hidden) void session.refreshIfDisconnected(); }, 60_000);
    return () => {
      session.dispose();
      if (changeTimer) clearTimeout(changeTimer);
      clearInterval(poll);
      void tvClient.removeChannel(channel);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('onethreenine:resume', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [retryIncompleteAssets]);

  useEffect(() => {
    document.documentElement.dataset.tvConnection = state.connection;
  }, [state.connection]);

  useEffect(() => {
    const root = document.documentElement;
    const controller = new AbortController();
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    if (assetSnapshot.current !== state.snapshot) {
      assetSnapshot.current = state.snapshot;
      assetAttempts.current = 0;
    }
    root.dataset.tvViewerReady = 'false';
    root.dataset.tvAssetsReady = 'false';
    root.dataset.tvSnapshotAt = state.snapshot ? String(state.snapshot.savedAt) : '';
    // Separate layout readiness from complete-image readiness for native offline capture.
    let secondFrame = 0;
    let assetsFrame = 0;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        root.dataset.tvViewerReady = state.snapshot ? 'true' : 'false';
        if (!state.snapshot || !artRef.current) return;
        void waitForTVAssets(artRef.current, controller.signal).then(() => {
          assetsFrame = requestAnimationFrame(() => {
            // Cleanup cancels the previous generation when a new snapshot is rendered.
            if (!controller.signal.aborted) {
              root.dataset.tvAssetsReady = 'true';
              assetAttempts.current = 0;
            }
          });
        }).catch(() => {
          // A transient CDN failure may happen without an offline/online event.
          // Three quiet retries (10/30/90s), then wait for a resume/network/data change.
          const delay = [10_000, 30_000, 90_000][assetAttempts.current];
          if (!disposed && delay !== undefined && navigator.onLine && !document.hidden) {
            retryTimer = setTimeout(() => retryIncompleteAssets(false), delay);
          }
        });
      });
    });
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timeout);
      if (retryTimer) clearTimeout(retryTimer);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      cancelAnimationFrame(assetsFrame);
    };
  }, [state.snapshot, viewport, assetRetry, retryIncompleteAssets]);

  const snapshot = state.snapshot;
  return (
    <main className="tv-board" aria-label="MonaLisa corkboard display">
      {snapshot ? (
        <div className="tv-art" inert ref={artRef} style={{ width: 1920, height: 1080,
          left: viewport.left, top: viewport.top, transform: `scale(${viewport.scale})` }}>
          <DndProvider backend={HTML5Backend}>
            <PegboardCanvas items={snapshot.items} users={snapshot.users}
              currentUserId={snapshot.viewer.id} isEditMode={false} isViewerMode={true}
              isArtTVMode={true} isMobile={false} isJiggleMode={false}
              layoutViewport={TV_DESIGN_VIEWPORT}
              selectedItemId={null} onSelectItem={ignore} onUpdateItem={ignore} onDeleteItem={ignore} />
          </DndProvider>
          <div className="tv-vignette" />
        </div>
      ) : (
        <div className="tv-loading" role="status">
          {state.error === 'missing-viewer' ? 'MonaLisa display profile unavailable' :
            state.connection === 'offline' ? 'Waiting for the corkboard connection' : 'Loading corkboard'}
        </div>
      )}
    </main>
  );
}

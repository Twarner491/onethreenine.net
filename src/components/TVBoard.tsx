import { useEffect, useRef, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { createClient } from '@supabase/supabase-js';
import { PegboardCanvas } from './PegboardCanvas';
import type { Database } from '../lib/database.types';
import { createTVBoardSource, TVBoardSession, type TVState } from '../lib/tv-board-session';
import { fitTVViewport, TV_DESIGN_VIEWPORT, waitForTVAssets } from '../lib/tv-board-presentation';

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
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const resize = () => setViewport(fitTVViewport(window.innerWidth, window.innerHeight));
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
    const online = () => { void session.setOnline(true); };
    const offline = () => { void session.setOnline(false); };
    const resume = () => { if (!document.hidden) void session.setOnline(navigator.onLine); };
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
    // A quiet periodic snapshot also recovers publication/configuration problems.
    const poll = setInterval(() => { if (!document.hidden) refresh(); }, 60_000);
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
  }, []);

  useEffect(() => {
    document.documentElement.dataset.tvConnection = state.connection;
  }, [state.connection]);

  useEffect(() => {
    const root = document.documentElement;
    const controller = new AbortController();
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
            if (!controller.signal.aborted) root.dataset.tvAssetsReady = 'true';
          });
        }).catch(() => { /* Keep the native last-good image; partial assets are not cacheable. */ });
      });
    });
    return () => {
      controller.abort();
      clearTimeout(timeout);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      cancelAnimationFrame(assetsFrame);
    };
  }, [state.snapshot, viewport]);

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
      {snapshot && state.connection !== 'live' && (
        <div className="tv-status" role="status">
          {state.connection === 'offline' ? 'Offline · showing saved board' : 'Reconnecting'}
        </div>
      )}
    </main>
  );
}

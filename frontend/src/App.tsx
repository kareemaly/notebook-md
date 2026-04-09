import { Menu, Moon, Search, Sun, Wifi, WifiOff, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useFile } from '@/hooks/useFile';
import { useFileTree } from '@/hooks/useFileTree';
import { useProjects } from '@/hooks/useProjects';
import { useSearch } from '@/hooks/useSearch';
import { useSidebarWidth } from '@/hooks/useSidebarWidth';
import { useTheme } from '@/hooks/useTheme';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { SearchMode, WSConfigReloadMessage, WSReloadMessage } from '@/types';
import { DocumentView } from './components/DocumentView';
import { FileExplorer } from './components/FileExplorer';
import { ProjectSwitcher } from './components/ProjectSwitcher';
import { SearchBar } from './components/SearchBar';
import { SearchResults } from './components/SearchResults';

// Read the initial state from the URL query string so a refresh/bookmark
// restores the exact document the user was viewing.
function readUrlState(): { projectId: string | null; filePath: string | null } {
  if (typeof window === 'undefined') return { projectId: null, filePath: null };
  const params = new URLSearchParams(window.location.search);
  return {
    projectId: params.get('project'),
    filePath: params.get('file'),
  };
}

export function App() {
  const initialUrl = useRef(readUrlState()).current;
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    initialUrl.projectId,
  );
  const [activeFilePath, setActiveFilePath] = useState<string | null>(
    initialUrl.filePath,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('filename');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { resolvedTheme, toggle: toggleTheme } = useTheme();
  const { width: sidebarWidth, dragging: resizing, handleProps: resizeHandleProps } =
    useSidebarWidth();
  const { projects, loading: projectsLoading, refetch: refetchProjects } = useProjects();
  const { tree } = useFileTree(activeProjectId);
  const { fileData, loading: fileLoading, error: fileError, refetch } = useFile(
    activeProjectId,
    activeFilePath,
  );
  const { results: searchResults, loading: searchLoading } = useSearch(
    activeProjectId,
    searchQuery,
    searchMode,
    searchCaseSensitive,
  );

  const handleReload = useCallback(
    (msg: WSReloadMessage) => {
      if (msg.event === 'unlink' && msg.path === activeFilePath) {
        setActiveFilePath(null);
      } else if (msg.path === activeFilePath) {
        refetch();
      }
    },
    [activeFilePath, refetch],
  );

  // Backend hot-reloads its config when notebook.config.json changes and
  // pushes a `config-reload` message with the new project list. Refetch
  // /api/projects so the switcher reflects renames/additions/removals,
  // and if the active project has been removed fall back to the first
  // available one (or empty state when the config is now empty).
  const handleConfigReload = useCallback(
    async (msg: WSConfigReloadMessage) => {
      const next = (await refetchProjects()) ?? msg.projects;
      const stillExists =
        activeProjectId !== null && next.some((p) => p.id === activeProjectId);
      if (!stillExists) {
        setActiveProjectId(next.length > 0 ? next[0].id : null);
        setActiveFilePath(null);
      }
    },
    [activeProjectId, refetchProjects],
  );

  const { status: wsStatus } = useWebSocket(activeProjectId, handleReload, handleConfigReload);

  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setActiveFilePath(null);
    setSearchQuery('');
  }, []);

  const selectFile = useCallback((path: string) => {
    setActiveFilePath(path);
    // Keep the search panel + query open so clicking a result keeps the
    // user in their current search session. The clicked row is already
    // highlighted via activeFilePath in SearchResults. Only close the
    // mobile drawer so the document becomes visible on small screens.
    setSidebarOpen(false);
  }, []);

  // Once projects are loaded, reconcile the active project with the URL:
  //   - if URL pointed at an unknown id, fall back to the first project
  //   - if URL had no project, auto-select the first one
  useEffect(() => {
    if (projectsLoading || projects.length === 0) return;
    const exists = activeProjectId && projects.some((p) => p.id === activeProjectId);
    if (!exists) {
      setActiveProjectId(projects[0].id);
      // An invalid project in the URL also invalidates the file.
      if (activeProjectId && !exists) setActiveFilePath(null);
    }
  }, [projects, projectsLoading, activeProjectId]);

  // Sync the current project/file to the URL. File clicks push a new
  // history entry so back/forward navigates between documents; other
  // transitions (project switches, initial reconciliation) replace the
  // current entry to avoid cluttering history.
  const lastUrlRef = useRef<string>('');
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeProjectId) params.set('project', activeProjectId);
    if (activeFilePath) params.set('file', activeFilePath);
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (next === lastUrlRef.current) return;
    // First render: replace so we don't add a history entry for initial state.
    if (lastUrlRef.current === '') {
      window.history.replaceState(null, '', next);
    } else {
      window.history.pushState(null, '', next);
    }
    lastUrlRef.current = next;
  }, [activeProjectId, activeFilePath]);

  // Back/forward navigation: re-read the URL and sync state.
  useEffect(() => {
    function onPopState() {
      const next = readUrlState();
      setActiveProjectId(next.projectId);
      setActiveFilePath(next.filePath);
      // Keep the ref in sync so the push effect above doesn't immediately
      // push a duplicate entry in response to the state change.
      const qs = new URLSearchParams();
      if (next.projectId) qs.set('project', next.projectId);
      if (next.filePath) qs.set('file', next.filePath);
      const qsStr = qs.toString();
      lastUrlRef.current = `${window.location.pathname}${qsStr ? `?${qsStr}` : ''}`;
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Global keyboard shortcuts:
  //   Cmd/Ctrl+K       → search filenames
  //   Cmd/Ctrl+Shift+K → search content
  //   Escape           → close mobile drawer
  // Pressing the same shortcut again while its mode is already active
  // toggles the search panel closed (IDE-style round-trip).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const nextMode: SearchMode = e.shiftKey ? 'content' : 'filename';
        setSidebarOpen(true);
        // Compute next open-state directly from current state rather
        // than calling a setter inside another setter's updater (which
        // StrictMode double-invokes).
        if (searchOpen && searchMode === nextMode) {
          setSearchOpen(false);
        } else {
          setSearchMode(nextMode);
          setSearchOpen(true);
        }
      } else if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, searchOpen, searchMode]);

  const isSearching = searchOpen && searchQuery.trim().length > 0;

  const sidebar = (
    <aside
      style={{ width: sidebarWidth }}
      className={`relative flex flex-col shrink-0 border-r bg-sidebar h-full
        md:static md:translate-x-0
        fixed inset-y-0 left-0 z-40
        ${resizing ? '' : 'transition-transform'}
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-semibold">Notebook</span>
        <div className="flex items-center gap-1">
          <div
            title={wsStatus}
            className={`size-1.5 rounded-full ${
              wsStatus === 'open'
                ? 'bg-green-500'
                : wsStatus === 'reconnecting'
                  ? 'bg-yellow-400'
                  : 'bg-muted-foreground'
            }`}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="size-3.5" />
            ) : (
              <Moon className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Toggle search"
            aria-pressed={searchOpen}
            title="Search — ⌘K filenames · ⌘⇧K content"
          >
            <Search className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Project switcher */}
      <div className="px-2 py-2 border-b">
        <ProjectSwitcher
          projects={projects}
          activeId={activeProjectId}
          onChange={selectProject}
        />
      </div>

      {/* Search or file tree */}
      {searchOpen ? (
        <div className="flex flex-col flex-1 min-h-0">
          <SearchBar
            query={searchQuery}
            mode={searchMode}
            caseSensitive={searchCaseSensitive}
            onQueryChange={setSearchQuery}
            onModeChange={setSearchMode}
            onToggleCaseSensitive={() => setSearchCaseSensitive((v) => !v)}
            onClose={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
          />
          {isSearching ? (
            <SearchResults
              results={searchResults}
              loading={searchLoading}
              activeFilePath={activeFilePath}
              onSelect={selectFile}
            />
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground italic">Type to search…</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 pt-1">
          <FileExplorer
            tree={tree}
            activeFilePath={activeFilePath}
            onSelectFile={selectFile}
          />
        </div>
      )}

      {/* Footer status */}
      <Separator />
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground">
        {wsStatus === 'open' ? (
          <Wifi className="size-3" />
        ) : (
          <WifiOff className="size-3" />
        )}
        {wsStatus === 'open' ? 'Live' : wsStatus === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
      </div>

      {/* Resize handle — a 6px invisible strip on the right edge of the
          sidebar that shows a 1px highlight on hover/drag. Hidden on
          mobile where the sidebar is a drawer, not a resizable pane. */}
      <div
        {...resizeHandleProps}
        className={`hidden md:block absolute top-0 right-0 h-full w-1.5 -mr-0.5 cursor-col-resize
          group z-50
          hover:bg-primary/20 active:bg-primary/30 transition-colors
          ${resizing ? 'bg-primary/30' : ''}`}
      />
    </aside>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {sidebar}

      {/* Backdrop for mobile drawer */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="size-4" />
          </Button>
          <span className="text-sm font-semibold">Notebook</span>
        </div>

        <DocumentView
          fileData={fileData}
          loading={fileLoading}
          error={fileError}
          projectId={activeProjectId}
          filePath={activeFilePath}
          // Only highlight the document body when the user is searching
          // content — a filename query has no meaningful relationship to
          // the words inside the current file, so matching it there is
          // confusing noise.
          highlight={searchOpen && searchMode === 'content' ? searchQuery : ''}
          highlightCaseSensitive={searchCaseSensitive}
        />
      </main>
    </div>
  );
}

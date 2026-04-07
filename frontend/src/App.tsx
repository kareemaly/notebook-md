import { Search, Wifi, WifiOff } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useFile } from '@/hooks/useFile';
import { useFileTree } from '@/hooks/useFileTree';
import { useProjects } from '@/hooks/useProjects';
import { useSearch } from '@/hooks/useSearch';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { SearchMode, WSReloadMessage } from '@/types';
import { DocumentView } from './components/DocumentView';
import { FileExplorer } from './components/FileExplorer';
import { ProjectSwitcher } from './components/ProjectSwitcher';
import { SearchBar } from './components/SearchBar';
import { SearchResults } from './components/SearchResults';

export function App() {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('filename');

  const { projects, loading: projectsLoading } = useProjects();
  const { tree } = useFileTree(activeProjectId);
  const { fileData, loading: fileLoading, error: fileError, refetch } = useFile(
    activeProjectId,
    activeFilePath,
  );
  const { results: searchResults, loading: searchLoading } = useSearch(
    activeProjectId,
    searchQuery,
    searchMode,
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

  const { status: wsStatus } = useWebSocket(activeProjectId, handleReload);

  function selectProject(id: string) {
    setActiveProjectId(id);
    setActiveFilePath(null);
    setSearchQuery('');
  }

  function selectFile(path: string) {
    setActiveFilePath(path);
    setSearchOpen(false);
    setSearchQuery('');
  }

  // Auto-select first project
  if (!activeProjectId && projects.length > 0 && !projectsLoading) {
    setActiveProjectId(projects[0].id);
  }

  const isSearching = searchOpen && searchQuery.trim().length > 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex flex-col w-64 shrink-0 border-r bg-sidebar">
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
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Toggle search"
              aria-pressed={searchOpen}
            >
              <Search className="size-3.5" />
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
              onQueryChange={setSearchQuery}
              onModeChange={setSearchMode}
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
      </aside>

      {/* Main content */}
      <main className="flex flex-col flex-1 min-w-0">
        <DocumentView
          fileData={fileData}
          loading={fileLoading}
          error={fileError}
          filePath={activeFilePath}
        />
      </main>
    </div>
  );
}

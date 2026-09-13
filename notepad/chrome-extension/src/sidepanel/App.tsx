import { useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { Header } from '@/components/Header';
import { CardGrid } from '@/components/CardGrid';
import { RephrasePanel } from '@/components/RephrasePanel';
import { HistoryPanel } from '@/components/HistoryPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { CardEditor } from '@/components/CardEditor';
import { OutputPanel } from '@/components/OutputPanel';

export function App() {
  const { 
    loadSettings, 
    loadCards, 
    loadHistory, 
    loadPageContext,
    loadWindowState,
    syncWindowState,
    setPanelOpen,
    activeView,
    isEditing,
    currentOutput,
    pageContext,
    selectedCard,
    draft,
    editorScrollTop,
    editorSelection,
    isGenerating,
    error,
    isLoading,
    setActiveView,
  } = useAppStore();

  useEffect(() => {
    let windowId = 0;
    const init = async () => {
      const win = await chrome.windows.getCurrent();
      windowId = win.id ?? 0;
      await setPanelOpen(true);
      await Promise.all([
        loadSettings(),
        loadCards(),
        loadHistory(),
        loadPageContext(),
        loadWindowState(windowId),
      ]);
    };

    init();

    const handleMessage = (message: any) => {
      if (message.type === 'REPHRASE_SELECTION') {
        setActiveView('rephrase');
        loadPageContext();
      } else if (message.type === 'RUN_CARD') {
        setActiveView('cards');
        loadPageContext();
      } else if (message.type === 'WINDOW_STATE_CHANGED' && message.payload?.windowId === windowId) {
        loadWindowState(windowId);
      }
    };

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== 'session' && areaName !== 'local') return;
      if (changes.ai_sidebar_window_state || changes.ai_sidebar_last_window_state) {
        loadWindowState(windowId);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    chrome.storage.onChanged.addListener(handleStorageChange);

    const persist = () => {
      if (windowId) {
        syncWindowState(windowId);
      }
    };

    window.addEventListener('beforeunload', persist);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
      window.removeEventListener('beforeunload', persist);
      if (windowId) {
        setPanelOpen(false);
      }
      if (windowId) {
        syncWindowState(windowId);
      }
    };
  }, [loadCards, loadHistory, loadPageContext, loadSettings, loadWindowState, setActiveView, setPanelOpen, syncWindowState]);

  useEffect(() => {
    if (!chrome?.windows) return;
    chrome.windows.getCurrent().then((win) => {
      if (win.id !== undefined) {
        syncWindowState(win.id);
      }
    });
  }, [activeView, isEditing, currentOutput, pageContext, selectedCard, draft, editorScrollTop, editorSelection, isGenerating, error, syncWindowState]);

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse-subtle text-accent">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-surface overflow-hidden">
      <Header />
      
      <main className="flex-1 overflow-hidden flex flex-col">
        {activeView === 'cards' && !isEditing && <CardGrid />}
        {activeView === 'cards' && isEditing && <CardEditor />}
        {activeView === 'rephrase' && <RephrasePanel />}
        {activeView === 'history' && <HistoryPanel />}
        {activeView === 'settings' && <SettingsPanel />}
      </main>

      {currentOutput && activeView === 'cards' && !isEditing && (
        <OutputPanel />
      )}
    </div>
  );
}

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
    activeView,
    isEditing,
    currentOutput,
    isLoading,
  } = useAppStore();

  useEffect(() => {
    loadSettings();
    loadCards();
    loadHistory();
    loadPageContext();
  }, []);

  if (isLoading) {
    return (
      <div className="w-[380px] h-[500px] flex items-center justify-center bg-surface">
        <div className="animate-pulse-subtle text-accent">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-[380px] h-[500px] flex flex-col bg-surface overflow-hidden">
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

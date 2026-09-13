import { Sparkles, RefreshCw, History, Settings, Plus } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { ModelSelector } from './ModelSelector';
import clsx from 'clsx';

export function Header() {
  const { 
    activeView, 
    setActiveView, 
    setIsEditing, 
    setSelectedCard,
    loadPageContext,
  } = useAppStore();

  const tabs = [
    { id: 'cards' as const, label: 'Cards', icon: Sparkles },
    { id: 'rephrase' as const, label: 'Rephrase', icon: RefreshCw },
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const handleAddCard = () => {
    setSelectedCard(null);
    setIsEditing(true);
    setActiveView('cards');
  };

  return (
    <header className="border-b border-surface-border bg-surface-secondary">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-text-primary">AI Sidebar</span>
        </div>

        <div className="flex items-center gap-2">
          <ModelSelector />
          <button
            onClick={handleAddCard}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
            title="Add new card"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={loadPageContext}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
            title="Refresh page context"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <nav className="flex px-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveView(tab.id);
              setIsEditing(false);
            }}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors border-b-2',
              activeView === tab.id
                ? 'text-accent border-accent'
                : 'text-text-muted border-transparent hover:text-text-secondary hover:border-surface-border'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

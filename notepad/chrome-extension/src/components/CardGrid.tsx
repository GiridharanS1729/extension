import { Play, Edit2, Copy, Trash2, MoreVertical } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { promptEngine } from '@/lib/prompt-engine';
import type { PromptCard, HistoryEntry, AIModel } from '@/types';
import clsx from 'clsx';

export function CardGrid() {
  const { 
    cards, 
    pageContext, 
    setSelectedCard, 
    setIsEditing,
    setCurrentOutput,
    setIsGenerating,
    isGenerating,
    setError,
    addHistoryEntry,
    settings,
  } = useAppStore();

  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-text-muted text-sm">No prompt cards yet</p>
          <p className="text-text-muted text-xs mt-1">Click + to create your first card</p>
        </div>
      ) : (
        cards.map(card => (
          <PromptCardItem
            key={card.id}
            card={card}
            pageContext={pageContext}
            isActive={activeMenu === card.id}
            setActiveMenu={setActiveMenu}
            isGenerating={isGenerating}
            onEdit={() => {
              setSelectedCard(card);
              setIsEditing(true);
            }}
            onRun={async () => {
              setIsGenerating(true);
              setCurrentOutput('');
              setError(null);

              let output = '';
              await promptEngine.executeCard(
                card,
                '',
                pageContext,
                {
                  onToken: (token) => {
                    output += token;
                    setCurrentOutput(output);
                  },
                  onComplete: (response) => {
                    setIsGenerating(false);
                    const entry: HistoryEntry = {
                      id: `${Date.now()}`,
                      cardId: card.id,
                      input: pageContext.selection || pageContext.pageContent?.slice(0, 200) || '',
                      output: response.content,
                      model: response.model,
                      provider: response.provider,
                      timestamp: Date.now(),
                      tokens: response.tokens,
                    };
                    addHistoryEntry(entry);
                  },
                  onError: (error) => {
                    setIsGenerating(false);
                    setError(error.message);
                    setCurrentOutput('');
                  },
                }
              );
            }}
          />
        ))
      )}
    </div>
  );
}

interface PromptCardItemProps {
  card: PromptCard;
  pageContext: any;
  isActive: boolean;
  setActiveMenu: (id: string | null) => void;
  isGenerating: boolean;
  onEdit: () => void;
  onRun: () => void;
}

function PromptCardItem({ 
  card, 
  isActive, 
  setActiveMenu, 
  isGenerating,
  onEdit, 
  onRun 
}: PromptCardItemProps) {
  const { deleteCard, duplicateCard } = useAppStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setActiveMenu]);

  const toneColors = {
    professional: 'badge-accent',
    casual: 'badge-success',
    neutral: 'badge-warning',
    strict: 'badge-error',
  };

  return (
    <div className="card group hover:border-surface-hover transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text-primary truncate">{card.title}</h3>
          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{card.description}</p>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRun}
            disabled={isGenerating}
            className={clsx(
              "p-1.5 rounded-lg transition-colors",
              isGenerating 
                ? "bg-surface-tertiary text-text-muted cursor-not-allowed"
                : "bg-accent text-white hover:bg-accent-hover"
            )}
            title="Run prompt"
          >
            <Play className="w-3.5 h-3.5" />
          </button>
          
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setActiveMenu(isActive ? null : card.id)}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {isActive && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-surface-secondary border border-surface-border rounded-lg shadow-xl z-50 py-1 animate-fade-in">
                <button
                  onClick={() => { onEdit(); setActiveMenu(null); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => { duplicateCard(card.id); setActiveMenu(null); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <Copy className="w-3 h-3" /> Duplicate
                </button>
                <button
                  onClick={() => { deleteCard(card.id); setActiveMenu(null); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-surface-hover transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className={clsx('badge', toneColors[card.template.tone])}>
          {card.template.tone}
        </span>
        {card.template.maxWords > 0 && (
          <span className="badge bg-surface-tertiary text-text-muted">
            ≤{card.template.maxWords} words
          </span>
        )}
        {card.modelOverride && (
          <span className="badge bg-surface-tertiary text-text-muted">
            {card.modelOverride}
          </span>
        )}
      </div>
    </div>
  );
}

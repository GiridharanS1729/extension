import { useState } from 'react';
import { Trash2, Copy, Check, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import clsx from 'clsx';

export function HistoryPanel() {
  const { history, cards, clearCardHistory, clearAllHistory } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getCardName = (cardId: string) => {
    if (cardId === 'rephrase') return 'Rephrase';
    const card = cards.find(c => c.id === cardId);
    return card?.title || 'Unknown';
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (history.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Clock className="w-10 h-10 text-text-muted mb-3" />
        <p className="text-sm text-text-secondary">No history yet</p>
        <p className="text-xs text-text-muted mt-1">Run some prompts to see history here</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
        <span className="text-xs text-text-muted">{history.length} entries</span>
        <button
          onClick={clearAllHistory}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-error hover:bg-surface-hover transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Clear All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {history.map(entry => (
          <div
            key={entry.id}
            className="card cursor-pointer hover:border-surface-hover transition-all"
            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="badge badge-accent">{getCardName(entry.cardId)}</span>
                  <span className="text-[10px] text-text-muted">{formatTime(entry.timestamp)}</span>
                </div>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {entry.output.slice(0, 100)}...
                </p>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(entry.id, entry.output);
                  }}
                  className="p-1.5 rounded hover:bg-surface-hover text-text-secondary transition-colors"
                >
                  {copiedId === entry.id ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                {expandedId === entry.id ? (
                  <ChevronUp className="w-4 h-4 text-text-muted" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-muted" />
                )}
              </div>
            </div>

            {expandedId === entry.id && (
              <div className="mt-3 pt-3 border-t border-surface-border space-y-3 animate-fade-in">
                <div>
                  <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Input</label>
                  <p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap">
                    {entry.input || 'No input text'}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Output</label>
                  <p className="text-xs text-text-primary mt-1 whitespace-pre-wrap">
                    {entry.output}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-text-muted">
                  <span>Model: {entry.model}</span>
                  <span>Provider: {entry.provider}</span>
                  {entry.tokens && (
                    <span>Tokens: {entry.tokens.prompt + entry.tokens.completion}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

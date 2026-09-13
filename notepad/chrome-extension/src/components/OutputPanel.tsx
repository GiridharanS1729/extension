import { useState } from 'react';
import { Copy, Check, X, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store/app-store';

export function OutputPanel() {
  const { currentOutput, setCurrentOutput, isGenerating, error, setError } = useAppStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setCurrentOutput('');
    setError(null);
  };

  if (error) {
    return (
      <div className="border-t border-surface-border bg-surface-secondary p-3 animate-slide-in">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
            <p className="text-sm text-error">{error}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-surface-hover text-text-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-surface-border bg-surface-secondary animate-slide-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
        <span className="text-xs font-medium text-text-secondary">
          {isGenerating ? 'Generating...' : 'Output'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            disabled={isGenerating}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-success" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-surface-hover text-text-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-40 overflow-y-auto p-3">
        <p className="text-sm text-text-primary whitespace-pre-wrap">
          {currentOutput}
          {isGenerating && <span className="animate-pulse-subtle">▊</span>}
        </p>
      </div>
    </div>
  );
}

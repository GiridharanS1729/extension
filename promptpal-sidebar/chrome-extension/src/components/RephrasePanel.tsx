import { useState } from 'react';
import { Send, RefreshCw, Copy, Check } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { promptEngine } from '@/lib/prompt-engine';
import type { ToneType, HistoryEntry } from '@/types';
import clsx from 'clsx';

const TONES: { value: ToneType; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'strict', label: 'Strict' },
];

const RULE_OPTIONS = [
  { id: 'noGreetings', label: 'No greetings' },
  { id: 'noExplanation', label: 'No explanation' },
  { id: 'outputOnly', label: 'Output only text' },
];

export function RephrasePanel() {
  const { 
    pageContext, 
    setCurrentOutput, 
    setIsGenerating, 
    isGenerating,
    currentOutput,
    addHistoryEntry,
    setError,
    settings,
  } = useAppStore();

  const [input, setInput] = useState(pageContext.selection || '');
  const [tone, setTone] = useState<ToneType>('professional');
  const [maxWords, setMaxWords] = useState(50);
  const [activeRules, setActiveRules] = useState<string[]>(['noGreetings', 'noExplanation', 'outputOnly']);
  const [copied, setCopied] = useState(false);

  const toggleRule = (ruleId: string) => {
    if (activeRules.includes(ruleId)) {
      setActiveRules(activeRules.filter(r => r !== ruleId));
    } else {
      setActiveRules([...activeRules, ruleId]);
    }
  };

  const handleRephrase = async () => {
    if (!input.trim()) return;

    setIsGenerating(true);
    setCurrentOutput('');
    setError(null);

    const rules: string[] = [];
    if (activeRules.includes('noGreetings')) rules.push('Do not include any greetings');
    if (activeRules.includes('noExplanation')) rules.push('Do not include any explanations');
    if (activeRules.includes('outputOnly')) rules.push('Output only the rephrased text');

    let output = '';
    await promptEngine.executeRephrase(
      input,
      tone,
      maxWords,
      rules,
      {
        onToken: (token) => {
          output += token;
          setCurrentOutput(output);
        },
        onComplete: (response) => {
          setIsGenerating(false);
          const entry: HistoryEntry = {
            id: `${Date.now()}`,
            cardId: 'rephrase',
            input: input,
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
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRephrase();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Input */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Text to Rephrase
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter or select text to rephrase..."
            rows={4}
            className="input resize-none"
          />
          <p className="text-[10px] text-text-muted mt-1">
            Shift+Enter for new line • Enter to send
          </p>
        </div>

        {/* Tone Selector */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Tone</label>
          <div className="grid grid-cols-4 gap-2">
            {TONES.map(t => (
              <button
                key={t.value}
                onClick={() => setTone(t.value)}
                className={clsx(
                  'px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  tone === t.value
                    ? 'bg-accent text-white'
                    : 'bg-surface-tertiary text-text-secondary hover:bg-surface-hover'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Max Words Slider */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Max Words: {maxWords === 0 ? 'Unlimited' : maxWords}
          </label>
          <input
            type="range"
            min="0"
            max="200"
            step="10"
            value={maxWords}
            onChange={(e) => setMaxWords(Number(e.target.value))}
            className="w-full h-2 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </div>

        {/* Rules */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Rules</label>
          <div className="space-y-2">
            {RULE_OPTIONS.map(rule => (
              <label
                key={rule.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={activeRules.includes(rule.id)}
                  onChange={() => toggleRule(rule.id)}
                  className="w-4 h-4 rounded border-surface-border bg-surface-tertiary text-accent focus:ring-accent focus:ring-offset-0"
                />
                <span className="text-xs text-text-primary">{rule.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Output */}
        {currentOutput && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-text-secondary">Output</label>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
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
            </div>
            <div className="p-3 bg-surface-tertiary rounded-lg border border-surface-border">
              <p className="text-sm text-text-primary whitespace-pre-wrap">{currentOutput}</p>
            </div>
          </div>
        )}
      </div>

      {/* Send Button */}
      <div className="p-3 border-t border-surface-border">
        <button
          onClick={handleRephrase}
          disabled={!input.trim() || isGenerating}
          className={clsx(
            'w-full btn text-sm py-2.5',
            isGenerating ? 'btn-secondary' : 'btn-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Rephrase
            </>
          )}
        </button>
      </div>
    </div>
  );
}

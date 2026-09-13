import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import type { AIModel, AIProvider } from '@/types';
import clsx from 'clsx';

const MODEL_LABELS: Record<AIModel, string> = {
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4.1': 'GPT-4.1',
  'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  'gemini-1.5-flash': 'Gemini 1.5 Flash',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'llama-3.1-70b': 'Llama 3.1 70B',
  'mixtral-8x7b': 'Mixtral 8x7B',
  'deepseek-chat': 'DeepSeek Chat',
  'deepseek-coder': 'DeepSeek Coder',
};

const PROVIDER_COLORS: Record<AIProvider, string> = {
  openai: 'bg-green-500',
  gemini: 'bg-blue-500',
  groq: 'bg-orange-500',
  deepseek: 'bg-purple-500',
};

export function ModelSelector() {
  const { settings, setDefaultModel } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const enabledProviders = Object.entries(settings.providers)
    .filter(([_, config]) => config.enabled && config.apiKey);

  const handleSelectModel = (model: AIModel, provider: AIProvider) => {
    setDefaultModel(model, provider);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-tertiary hover:bg-surface-hover text-xs font-medium text-text-secondary transition-colors"
      >
        <span className={clsx('w-2 h-2 rounded-full', PROVIDER_COLORS[settings.defaultProvider])} />
        <span className="max-w-[100px] truncate">{MODEL_LABELS[settings.defaultModel]}</span>
        <ChevronDown className={clsx('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-surface-secondary border border-surface-border rounded-lg shadow-xl z-50 py-1 animate-fade-in">
          {enabledProviders.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted text-center">
              Add API keys in Settings
            </div>
          ) : (
            enabledProviders.map(([provider, config]) => (
              <div key={provider}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  {config.name}
                </div>
                {config.models.map((model: AIModel) => (
                  <button
                    key={model}
                    onClick={() => handleSelectModel(model, provider as AIProvider)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-surface-hover transition-colors',
                      settings.defaultModel === model ? 'text-accent' : 'text-text-primary'
                    )}
                  >
                    <span>{MODEL_LABELS[model]}</span>
                    {settings.defaultModel === model && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import type { AIProvider } from '@/types';
import clsx from 'clsx';

const PROVIDER_INFO: Record<AIProvider, { name: string; placeholder: string; helpUrl: string }> = {
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    name: 'Google Gemini',
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/app/apikey',
  },
  groq: {
    name: 'Groq',
    placeholder: 'gsk_...',
    helpUrl: 'https://console.groq.com/keys',
  },
  deepseek: {
    name: 'DeepSeek',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.deepseek.com/api_keys',
  },
};

export function SettingsPanel() {
  const { settings, updateProviderKey, updateSettings } = useAppStore();
  const [showKeys, setShowKeys] = useState<Record<AIProvider, boolean>>({
    openai: false,
    gemini: false,
    groq: false,
    deepseek: false,
  });
  const [tempKeys, setTempKeys] = useState<Record<AIProvider, string>>({
    openai: settings.providers.openai.apiKey,
    gemini: settings.providers.gemini.apiKey,
    groq: settings.providers.groq.apiKey,
    deepseek: settings.providers.deepseek.apiKey,
  });
  const [saved, setSaved] = useState<AIProvider | null>(null);

  const handleSaveKey = async (provider: AIProvider) => {
    await updateProviderKey(provider, tempKeys[provider]);
    setSaved(provider);
    setTimeout(() => setSaved(null), 2000);
  };

  const toggleShowKey = (provider: AIProvider) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const enabledCount = Object.values(settings.providers).filter(p => p.enabled).length;

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-6">
      {/* API Status */}
      <div className="flex items-center gap-2 p-3 bg-surface-tertiary rounded-lg">
        {enabledCount > 0 ? (
          <>
            <Check className="w-4 h-4 text-success" />
            <span className="text-sm text-text-primary">
              {enabledCount} provider{enabledCount > 1 ? 's' : ''} configured
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4 text-warning" />
            <span className="text-sm text-text-secondary">
              Add at least one API key to get started
            </span>
          </>
        )}
      </div>

      {/* API Keys */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          API Keys
        </h3>

        {(Object.keys(PROVIDER_INFO) as AIProvider[]).map(provider => (
          <div key={provider} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-primary">
                {PROVIDER_INFO[provider].name}
              </label>
              <a
                href={PROVIDER_INFO[provider].helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-accent hover:underline"
              >
                Get API Key →
              </a>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeys[provider] ? 'text' : 'password'}
                  value={tempKeys[provider]}
                  onChange={(e) => setTempKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                  placeholder={PROVIDER_INFO[provider].placeholder}
                  className="input pr-10"
                />
                <button
                  onClick={() => toggleShowKey(provider)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary"
                >
                  {showKeys[provider] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <button
                onClick={() => handleSaveKey(provider)}
                disabled={tempKeys[provider] === settings.providers[provider].apiKey}
                className={clsx(
                  'btn text-sm px-3',
                  saved === provider ? 'btn-primary' : 'btn-secondary',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {saved === provider ? (
                  <Check className="w-4 h-4" />
                ) : (
                  'Save'
                )}
              </button>
            </div>

            {settings.providers[provider].enabled && (
              <p className="text-[10px] text-success flex items-center gap-1">
                <Check className="w-3 h-3" /> Active
              </p>
            )}
          </div>
        ))}
      </div>

      {/* General Settings */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          General
        </h3>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            History Size
          </label>
          <select
            value={settings.historySize}
            onChange={(e) => updateSettings({ historySize: Number(e.target.value) })}
            className="input"
          >
            <option value={25}>25 entries</option>
            <option value={50}>50 entries</option>
            <option value={100}>100 entries</option>
            <option value={200}>200 entries</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            UI Mode
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => updateSettings({ uiMode: 'popup' })}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                settings.uiMode === 'popup'
                  ? 'bg-accent text-white'
                  : 'bg-surface-tertiary text-text-secondary hover:bg-surface-hover'
              )}
            >
              Popup
            </button>
            <button
              onClick={() => updateSettings({ uiMode: 'sidepanel' })}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                settings.uiMode === 'sidepanel'
                  ? 'bg-accent text-white'
                  : 'bg-surface-tertiary text-text-secondary hover:bg-surface-hover'
              )}
            >
              Side Panel
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Keyboard Shortcuts
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-text-secondary">Toggle Sidebar</span>
            <kbd className="px-2 py-0.5 bg-surface-tertiary rounded text-text-muted font-mono">
              Ctrl+Shift+Y
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-text-secondary">Copy Last Output</span>
            <kbd className="px-2 py-0.5 bg-surface-tertiary rounded text-text-muted font-mono">
              Ctrl+Shift+C
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-text-secondary">Send Prompt</span>
            <kbd className="px-2 py-0.5 bg-surface-tertiary rounded text-text-muted font-mono">
              Enter
            </kbd>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-text-secondary">New Line</span>
            <kbd className="px-2 py-0.5 bg-surface-tertiary rounded text-text-muted font-mono">
              Shift+Enter
            </kbd>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-[10px] text-text-muted">
        AI Prompt Sidebar v1.0.0 • Local only • No tracking
      </div>
    </div>
  );
}

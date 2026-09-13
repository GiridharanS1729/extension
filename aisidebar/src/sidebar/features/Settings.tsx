import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Plus, RotateCcw, Save, Trash2, XCircle } from 'lucide-react';
import { defaultSettings, useSidebarStore } from '../../store';
import type { Provider, ProviderKind, Settings as SettingsType } from '../../types';
import { uid } from '../../utils';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="field"><span>{label}</span>{children}</label>;

export const Settings = () => {
  const settings = useSidebarStore((state) => state.settings);
  const providers = useSidebarStore((state) => state.providers);
  const activeProviderId = useSidebarStore((state) => state.activeProviderId);
  const setProvider = useSidebarStore((state) => state.setProvider);
  const saveProvider = useSidebarStore((state) => state.saveProvider);
  const removeProvider = useSidebarStore((state) => state.removeProvider);
  const updateSettings = useSidebarStore((state) => state.updateSettings);
  const resetSettings = useSidebarStore((state) => state.resetSettings);
  const [draft, setDraft] = useState<SettingsType>(settings);
  const [providerDraft, setProviderDraft] = useState<Provider>(providers.find(({ id }) => id === activeProviderId) ?? providers[0]);
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');

  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => { const selected = providers.find(({ id }) => id === activeProviderId); if (selected) setProviderDraft(selected); }, [activeProviderId, providers]);

  if (!providerDraft) return null;
  const patchProvider = (patch: Partial<Provider>) => setProviderDraft((current) => ({ ...current, ...patch }));
  const testProvider = async () => {
    setTest('testing');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'test-provider', provider: providerDraft }) as { ok: boolean };
      setTest(response.ok ? 'ok' : 'error');
    } catch { setTest('error'); }
  };

  return (
    <section className="view settings-view">
      <div className="view-heading"><div><h2>Settings</h2><p>Providers, generation and appearance</p></div><button type="button" title="Reset settings" onClick={() => void resetSettings()}><RotateCcw /></button></div>
      <form onSubmit={(event) => { event.preventDefault(); void updateSettings(draft); }}>
        <fieldset><legend>AI provider</legend>
          <Field label="Provider"><div className="provider-select"><select value={activeProviderId} onChange={(event) => setProvider(event.target.value)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select><button type="button" title="Add compatible provider" onClick={() => { const provider: Provider = { id: uid(), kind: 'compatible', name: 'Custom Provider', apiKey: '', baseUrl: 'http://localhost:8080/v1', model: 'default', enabled: true }; void saveProvider(provider).then(() => setProvider(provider.id)); }}><Plus /></button></div></Field>
          <Field label="Name"><input value={providerDraft.name} onChange={(event) => patchProvider({ name: event.target.value })} /></Field>
          <Field label="Type"><select value={providerDraft.kind} onChange={(event) => patchProvider({ kind: event.target.value as ProviderKind })}>{['openai', 'anthropic', 'gemini', 'openrouter', 'groq', 'mistral', 'deepseek', 'ollama', 'lmstudio', 'compatible'].map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></Field>
          <Field label="API key"><div className="secret"><input type={showKey ? 'text' : 'password'} value={providerDraft.apiKey} autoComplete="off" onChange={(event) => patchProvider({ apiKey: event.target.value })} placeholder={['ollama', 'lmstudio'].includes(providerDraft.kind) ? 'Optional' : 'Required'} /><button type="button" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff /> : <Eye />}</button></div></Field>
          <Field label="Base URL"><input type="url" value={providerDraft.baseUrl} onChange={(event) => patchProvider({ baseUrl: event.target.value })} /></Field>
          <Field label="Model"><input value={providerDraft.model} onChange={(event) => patchProvider({ model: event.target.value })} /></Field>
          <div className="provider-actions"><button type="button" onClick={() => void testProvider()} disabled={test === 'testing'}>{test === 'ok' ? <CheckCircle2 /> : test === 'error' ? <XCircle /> : null}{test === 'testing' ? 'Testing…' : test === 'ok' ? 'Connected' : test === 'error' ? 'Failed' : 'Test connection'}</button><button type="button" className="primary" onClick={() => void saveProvider(providerDraft)}><Save />Save provider</button>{providers.length > 1 && <button type="button" className="danger" title="Remove provider" onClick={() => void removeProvider(providerDraft.id)}><Trash2 /></button>}</div>
        </fieldset>
        <fieldset><legend>Generation</legend>
          <Field label={`Temperature · ${draft.temperature}`}><input type="range" min="0" max="2" step="0.1" value={draft.temperature} onChange={(event) => setDraft({ ...draft, temperature: Number(event.target.value) })} /></Field>
          <Field label={`Top P · ${draft.topP}`}><input type="range" min="0" max="1" step="0.05" value={draft.topP} onChange={(event) => setDraft({ ...draft, topP: Number(event.target.value) })} /></Field>
          <Field label="Max tokens"><input type="number" min="64" max="128000" value={draft.maxTokens} onChange={(event) => setDraft({ ...draft, maxTokens: Number(event.target.value) })} /></Field>
          {(['streaming', 'autoCopy', 'autoScroll', 'developerMode'] as const).map((key) => <label className="toggle" key={key}><span>{key.replace(/([A-Z])/g, ' $1')}</span><input type="checkbox" checked={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} /></label>)}
        </fieldset>
        <fieldset><legend>Appearance</legend>
          <Field label="Theme"><select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as SettingsType['theme'] })}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></Field>
          <Field label="Accent"><input type="color" value={draft.accent} onChange={(event) => setDraft({ ...draft, accent: event.target.value })} /></Field>
          <Field label={`Font size · ${draft.fontSize}px`}><input type="range" min="12" max="20" value={draft.fontSize} onChange={(event) => setDraft({ ...draft, fontSize: Number(event.target.value) })} /></Field>
          <Field label={`Sidebar width · ${draft.width}px`}><input type="range" min="360" max="720" value={draft.width} onChange={(event) => setDraft({ ...draft, width: Number(event.target.value) })} /></Field>
          <label className="toggle"><span>Animations</span><input type="checkbox" checked={draft.animations} onChange={(event) => setDraft({ ...draft, animations: event.target.checked })} /></label>
        </fieldset>
        <div className="settings-save"><button type="button" onClick={() => setDraft(defaultSettings)}>Defaults</button><button type="submit" className="primary"><Save />Save settings</button></div>
      </form>
    </section>
  );
};

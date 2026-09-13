import { create } from 'zustand';
import { db } from '../db';
import { streamCompletion } from '../services/chat';
import type { Chat, Message, Prompt, Provider, Settings, StreamEvent } from '../types';
import { uid } from '../utils';

export const defaultSettings: Settings = {
  width: 440,
  theme: 'dark',
  accent: '#8b5cf6',
  animations: true,
  fontSize: 14,
  temperature: 0.7,
  topP: 1,
  maxTokens: 4096,
  streaming: true,
  autoCopy: false,
  autoScroll: true,
  developerMode: false,
};

const defaultProviders: Provider[] = [
  { id: 'openai', kind: 'openai', name: 'OpenAI', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', enabled: true },
  { id: 'anthropic', kind: 'anthropic', name: 'Anthropic', apiKey: '', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514', enabled: true },
  { id: 'gemini', kind: 'gemini', name: 'Gemini', apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models', model: 'gemini-2.5-flash', enabled: true },
  { id: 'openrouter', kind: 'openrouter', name: 'OpenRouter', apiKey: '', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4.1-mini', enabled: true },
  { id: 'groq', kind: 'groq', name: 'Groq', apiKey: '', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', enabled: true },
  { id: 'mistral', kind: 'mistral', name: 'Mistral', apiKey: '', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', enabled: true },
  { id: 'deepseek', kind: 'deepseek', name: 'DeepSeek', apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', enabled: true },
  { id: 'ollama', kind: 'ollama', name: 'Ollama', apiKey: '', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', enabled: true },
  { id: 'lmstudio', kind: 'lmstudio', name: 'LM Studio', apiKey: '', baseUrl: 'http://localhost:1234/v1', model: 'local-model', enabled: true },
  { id: 'compatible', kind: 'compatible', name: 'OpenAI Compatible', apiKey: '', baseUrl: 'http://localhost:8080/v1', model: 'default', enabled: true },
];

interface SidebarState {
  hydrated: boolean;
  open: boolean;
  view: 'chat' | 'history' | 'prompts' | 'settings';
  commandOpen: boolean;
  chats: Chat[];
  messages: Message[];
  providers: Provider[];
  prompts: Prompt[];
  settings: Settings;
  activeChatId?: string;
  activeProviderId: string;
  generating: boolean;
  error?: string;
  cancel?: () => void;
  hydrate: () => Promise<void>;
  setOpen: (open: boolean) => void;
  setView: (view: SidebarState['view']) => void;
  setCommandOpen: (open: boolean) => void;
  setActiveChat: (id: string) => Promise<void>;
  newChat: () => Promise<string>;
  send: (content: string, attachments?: Message['attachments']) => Promise<void>;
  stop: () => void;
  regenerate: () => Promise<void>;
  updateChat: (id: string, patch: Partial<Chat>) => Promise<void>;
  duplicateChat: (id: string) => Promise<void>;
  deleteChats: (ids: string[], permanent?: boolean) => Promise<void>;
  clearChat: () => Promise<void>;
  updateMessage: (id: string, content: string) => Promise<void>;
  copyLast: () => Promise<void>;
  setProvider: (id: string) => void;
  saveProvider: (provider: Provider) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  savePrompt: (prompt: Prompt) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  importChats: (value: string) => Promise<void>;
}

const messagesFor = async (chatId: string) => db.messages.where('chatId').equals(chatId).sortBy('createdAt');

export const useSidebarStore = create<SidebarState>((set, get) => ({
  hydrated: false,
  open: false,
  view: 'chat',
  commandOpen: false,
  chats: [],
  messages: [],
  providers: [],
  prompts: [],
  settings: defaultSettings,
  activeProviderId: 'gemini',
  generating: false,
  hydrate: async () => {
    try {
      const { sidebarOpen = false } = await chrome.storage.local.get('sidebarOpen') as { sidebarOpen?: boolean };
      let providers = await db.providers.toArray();
      if (!providers.length) {
        await db.providers.bulkPut(defaultProviders);
        providers = defaultProviders;
      }
      const chats = await db.chats.orderBy('updatedAt').reverse().toArray();
      const storedSettings = await db.settings.get('main');
      const prompts = await db.prompts.toArray();
      const activeChatId = chats.find((chat) => !chat.deletedAt && !chat.archived)?.id;
      set({ open: sidebarOpen, providers, chats, prompts, settings: storedSettings ? { ...defaultSettings, ...storedSettings } : defaultSettings, activeChatId, messages: activeChatId ? await messagesFor(activeChatId) : [], activeProviderId: chats.find((chat) => chat.id === activeChatId)?.providerId ?? 'gemini', hydrated: true });
    } catch {
      set({ providers: defaultProviders, settings: defaultSettings, hydrated: true, error: 'Local storage is unavailable on this page.' });
    }
  },
  setOpen: (open) => {
    set({ open });
    void chrome.runtime.sendMessage({ type: 'set-sidebar-open', open });
  },
  setView: (view) => set({ view }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setActiveChat: async (activeChatId) => set({ activeChatId, messages: await messagesFor(activeChatId), view: 'chat', activeProviderId: get().chats.find((chat) => chat.id === activeChatId)?.providerId ?? get().activeProviderId }),
  newChat: async () => {
    const now = Date.now();
    const chat: Chat = { id: uid(), title: 'New chat', createdAt: now, updatedAt: now, pinned: false, favorite: false, archived: false, providerId: get().activeProviderId };
    await db.chats.add(chat);
    set((state) => ({ chats: [chat, ...state.chats], activeChatId: chat.id, messages: [], view: 'chat' }));
    return chat.id;
  },
  send: async (rawContent, attachments = []) => {
    const content = rawContent.trim();
    if ((!content && !attachments.length) || get().generating) return;
    const chatId = get().activeChatId ?? await get().newChat();
    const now = Date.now();
    const attachmentText = attachments.map((file) => `\n\n--- ${file.name} ---\n${file.content}`).join('');
    const user: Message = { id: uid(), chatId, role: 'user', content: `${content}${attachmentText}`, createdAt: now, attachments };
    const assistant: Message = { id: uid(), chatId, role: 'assistant', content: '', createdAt: now + 1 };
    await db.messages.bulkAdd([user, assistant]);
    const existing = get().messages;
    const chat = get().chats.find(({ id }) => id === chatId);
    const title = chat?.title === 'New chat' ? (content || attachments[0]?.name || 'New chat').slice(0, 60) : chat?.title;
    await get().updateChat(chatId, { updatedAt: now, title });
    set({ messages: [...existing, user, assistant], generating: true, error: undefined });
    const provider = get().providers.find(({ id }) => id === get().activeProviderId);
    if (!provider) {
      set({ generating: false, error: 'Select a provider in Settings.' });
      return;
    }
    if (!provider.apiKey && !['ollama', 'lmstudio', 'compatible'].includes(provider.kind)) {
      set({ generating: false, error: `Add a ${provider.name} API key in Settings.` });
      return;
    }
    const requestId = uid();
    const history = [...existing, user].map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    const onEvent = async (event: StreamEvent) => {
      if (event.requestId !== requestId) return;
      if (event.type === 'chunk') {
        set((state) => ({ messages: state.messages.map((message) => message.id === assistant.id ? { ...message, content: message.content + event.content } : message) }));
      } else if (event.type === 'done') {
        const completed = get().messages.find(({ id }) => id === assistant.id);
        if (completed) await db.messages.put(completed);
        if (completed && get().settings.autoCopy) await navigator.clipboard.writeText(completed.content);
        get().cancel?.();
        set({ generating: false, cancel: undefined });
      } else {
        await db.messages.delete(assistant.id);
        set((state) => ({ messages: state.messages.filter(({ id }) => id !== assistant.id), generating: false, cancel: undefined, error: event.error }));
      }
    };
    const cancel = streamCompletion({ requestId, provider, messages: history, settings: get().settings }, onEvent);
    set({ cancel });
  },
  stop: () => {
    const state = get();
    state.cancel?.();
    const last = state.messages.at(-1);
    if (last?.role === 'assistant') {
      const stopped = { ...last, stopped: true };
      void db.messages.put(stopped);
      set({ messages: state.messages.map((message) => message.id === stopped.id ? stopped : message), generating: false, cancel: undefined });
    }
  },
  regenerate: async () => {
    const messages = get().messages;
    const lastUserIndex = messages.findLastIndex(({ role }) => role === 'user');
    if (lastUserIndex < 0) return;
    const user = messages[lastUserIndex];
    await db.messages.bulkDelete(messages.slice(lastUserIndex).map(({ id }) => id));
    set({ messages: messages.slice(0, lastUserIndex) });
    await get().send(user.content, user.attachments);
  },
  updateChat: async (id, patch) => {
    await db.chats.update(id, patch);
    set((state) => ({ chats: state.chats.map((chat) => chat.id === id ? { ...chat, ...patch } : chat).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt) }));
  },
  duplicateChat: async (id) => {
    const source = get().chats.find((chat) => chat.id === id);
    if (!source) return;
    const now = Date.now();
    const copy: Chat = { ...source, id: uid(), title: `${source.title} (copy)`, createdAt: now, updatedAt: now, pinned: false };
    const messages = (await messagesFor(id)).map((message, index) => ({ ...message, id: uid(), chatId: copy.id, createdAt: now + index }));
    await db.transaction('rw', db.chats, db.messages, async () => { await db.chats.add(copy); await db.messages.bulkAdd(messages); });
    set((state) => ({ chats: [copy, ...state.chats] }));
  },
  deleteChats: async (ids, permanent = false) => {
    if (permanent) {
      await db.transaction('rw', db.chats, db.messages, async () => { await db.chats.bulkDelete(ids); await db.messages.where('chatId').anyOf(ids).delete(); });
      set((state) => ({ chats: state.chats.filter(({ id }) => !ids.includes(id)), activeChatId: ids.includes(state.activeChatId ?? '') ? undefined : state.activeChatId, messages: ids.includes(state.activeChatId ?? '') ? [] : state.messages }));
    } else {
      const deletedAt = Date.now();
      await Promise.all(ids.map((id) => get().updateChat(id, { deletedAt })));
      if (ids.includes(get().activeChatId ?? '')) set({ activeChatId: undefined, messages: [] });
    }
  },
  clearChat: async () => {
    const id = get().activeChatId;
    if (!id) return;
    await db.messages.where('chatId').equals(id).delete();
    set({ messages: [] });
  },
  updateMessage: async (id, content) => {
    await db.messages.update(id, { content });
    set((state) => ({ messages: state.messages.map((message) => message.id === id ? { ...message, content } : message) }));
  },
  copyLast: async () => {
    const last = get().messages.findLast(({ role }) => role === 'assistant');
    if (last) await navigator.clipboard.writeText(last.content);
  },
  setProvider: (activeProviderId) => {
    set({ activeProviderId });
    const id = get().activeChatId;
    if (id) void get().updateChat(id, { providerId: activeProviderId });
  },
  saveProvider: async (provider) => {
    await db.providers.put(provider);
    set((state) => ({ providers: state.providers.some(({ id }) => id === provider.id) ? state.providers.map((item) => item.id === provider.id ? provider : item) : [...state.providers, provider] }));
  },
  removeProvider: async (id) => {
    await db.providers.delete(id);
    set((state) => ({ providers: state.providers.filter((provider) => provider.id !== id), activeProviderId: state.activeProviderId === id ? state.providers.find((provider) => provider.id !== id)?.id ?? '' : state.activeProviderId }));
  },
  updateSettings: async (patch) => {
    const settings = { ...get().settings, ...patch };
    await db.settings.put({ id: 'main', ...settings });
    set({ settings });
  },
  resetSettings: async () => {
    await db.settings.put({ id: 'main', ...defaultSettings });
    set({ settings: defaultSettings });
  },
  savePrompt: async (prompt) => {
    await db.prompts.put(prompt);
    set((state) => ({ prompts: state.prompts.some(({ id }) => id === prompt.id) ? state.prompts.map((item) => item.id === prompt.id ? prompt : item) : [...state.prompts, prompt] }));
  },
  deletePrompt: async (id) => {
    await db.prompts.delete(id);
    set((state) => ({ prompts: state.prompts.filter((prompt) => prompt.id !== id) }));
  },
  importChats: async (value) => {
    const parsed = JSON.parse(value) as { chats?: Chat[]; messages?: Message[] };
    if (!Array.isArray(parsed.chats) || !Array.isArray(parsed.messages)) throw new Error('Invalid chat export.');
    await db.transaction('rw', db.chats, db.messages, async () => { await db.chats.bulkPut(parsed.chats ?? []); await db.messages.bulkPut(parsed.messages ?? []); });
    set({ chats: await db.chats.orderBy('updatedAt').reverse().toArray() });
  },
}));

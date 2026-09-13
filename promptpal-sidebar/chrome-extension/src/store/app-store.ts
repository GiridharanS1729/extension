import { create } from 'zustand';
import type { Settings, PromptCard, HistoryEntry, AIModel, AIProvider, PageContext, CardDraft } from '@/types';
import { storage, defaultSettings, defaultPromptCards } from '@/lib/storage';

interface WindowState {
  panelOpen: boolean;
  activeView: 'cards' | 'rephrase' | 'history' | 'settings';
  selectedCard: PromptCard | null;
  isEditing: boolean;
  pageContext: PageContext;
  currentOutput: string;
  isGenerating: boolean;
  error: string | null;
  draft: CardDraft;
  editorScrollTop: number;
  editorSelection: { start: number; end: number; field: keyof CardDraft | null };
}

const defaultDraft: CardDraft = {
  title: '',
  description: '',
  system: '',
  instruction: '',
  tone: 'professional',
  maxWords: 100,
  rules: [],
  newRule: '',
  modelOverride: '',
  variables: ['selection'],
};

const defaultWindowState: WindowState = {
  panelOpen: false,
  activeView: 'cards',
  selectedCard: null,
  isEditing: false,
  pageContext: {
    selection: '',
    pageTitle: '',
    pageUrl: '',
    pageContent: '',
  },
  currentOutput: '',
  isGenerating: false,
  error: null,
  draft: defaultDraft,
  editorScrollTop: 0,
  editorSelection: { start: 0, end: 0, field: null },
};

interface AppState {
  // Settings
  settings: Settings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  updateProviderKey: (provider: AIProvider, key: string) => Promise<void>;
  setDefaultModel: (model: AIModel, provider: AIProvider) => Promise<void>;

  // Prompt Cards
  cards: PromptCard[];
  loadCards: () => Promise<void>;
  addCard: (card: PromptCard) => Promise<void>;
  updateCard: (card: PromptCard) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  duplicateCard: (id: string) => Promise<void>;
  reorderCards: (ids: string[]) => Promise<void>;

  // History
  history: HistoryEntry[];
  loadHistory: () => Promise<void>;
  addHistoryEntry: (entry: HistoryEntry) => Promise<void>;
  clearCardHistory: (cardId: string) => Promise<void>;
  clearAllHistory: () => Promise<void>;

  // UI State
  activeView: 'cards' | 'rephrase' | 'history' | 'settings';
  setActiveView: (view: 'cards' | 'rephrase' | 'history' | 'settings') => void;
  selectedCard: PromptCard | null;
  setSelectedCard: (card: PromptCard | null) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  draft: CardDraft;
  setDraft: (draft: Partial<CardDraft>) => void;
  resetDraft: () => void;
  editorScrollTop: number;
  setEditorScrollTop: (scrollTop: number) => void;
  editorSelection: { start: number; end: number; field: keyof CardDraft | null };
  setEditorSelection: (selection: { start: number; end: number; field: keyof CardDraft | null }) => void;

  // Page Context
  pageContext: PageContext;
  loadPageContext: () => Promise<void>;

  // Output
  currentOutput: string;
  setCurrentOutput: (output: string) => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  syncWindowState: (windowId: number) => Promise<void>;
  setPanelOpen: (open: boolean) => Promise<void>;
  loadWindowState: (windowId: number) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Settings
  settings: defaultSettings,
  isLoading: true,

  loadSettings: async () => {
    const settings = await storage.getSettings();
    set({ settings, isLoading: false });
  },

  updateSettings: async (partial) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    await storage.saveSettings(updated);
    set({ settings: updated });
  },

  updateProviderKey: async (provider, key) => {
    await storage.updateProviderKey(provider, key);
    await get().loadSettings();
  },

  setDefaultModel: async (model, provider) => {
    await storage.setDefaultModel(model, provider);
    await get().loadSettings();
  },

  // Prompt Cards
  cards: [],

  loadCards: async () => {
    const cards = await storage.getPromptCards();
    set({ cards: cards.sort((a, b) => a.order - b.order) });
  },

  addCard: async (card) => {
    await storage.addPromptCard(card);
    await get().loadCards();
    chrome.runtime.sendMessage({ type: 'REFRESH_CONTEXT_MENUS' });
  },

  updateCard: async (card) => {
    await storage.updatePromptCard(card);
    await get().loadCards();
    chrome.runtime.sendMessage({ type: 'REFRESH_CONTEXT_MENUS' });
  },

  deleteCard: async (id) => {
    await storage.deletePromptCard(id);
    await get().loadCards();
    chrome.runtime.sendMessage({ type: 'REFRESH_CONTEXT_MENUS' });
  },

  duplicateCard: async (id) => {
    const cards = get().cards;
    const original = cards.find(c => c.id === id);
    if (original) {
      const duplicate: PromptCard = {
        ...original,
        id: `${original.id}-copy-${Date.now()}`,
        title: `${original.title} (Copy)`,
        order: cards.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await get().addCard(duplicate);
    }
  },

  reorderCards: async (ids) => {
    await storage.reorderPromptCards(ids);
    await get().loadCards();
    chrome.runtime.sendMessage({ type: 'REFRESH_CONTEXT_MENUS' });
  },

  // History
  history: [],

  loadHistory: async () => {
    const history = await storage.getHistory();
    set({ history });
  },

  addHistoryEntry: async (entry) => {
    await storage.addHistoryEntry(entry);
    await get().loadHistory();
    // Save last output for keyboard shortcut
    chrome.runtime.sendMessage({ 
      type: 'SAVE_LAST_OUTPUT', 
      payload: { output: entry.output } 
    });
  },

  clearCardHistory: async (cardId) => {
    await storage.clearCardHistory(cardId);
    await get().loadHistory();
  },

  clearAllHistory: async () => {
    await storage.clearAllHistory();
    await get().loadHistory();
  },

  // UI State
  activeView: 'cards',
  setActiveView: (view) => set({ activeView: view }),
  selectedCard: null,
  setSelectedCard: (card) => set({ selectedCard: card }),
  isEditing: false,
  setIsEditing: (editing) => set({ isEditing: editing }),
  draft: defaultDraft,
  setDraft: (draft) => set({ draft: { ...get().draft, ...draft } }),
  resetDraft: () => set({ draft: defaultDraft }),
  editorScrollTop: 0,
  setEditorScrollTop: (editorScrollTop) => set({ editorScrollTop }),
  editorSelection: { start: 0, end: 0, field: null },
  setEditorSelection: (editorSelection) => set({ editorSelection }),

  // Page Context
  pageContext: {
    selection: '',
    pageTitle: '',
    pageUrl: '',
    pageContent: '',
  },

  loadPageContext: async () => {
    try {
      const context = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTEXT' });
      set({ pageContext: context });
    } catch {
      // Fallback for popup mode
      set({ 
        pageContext: { 
          selection: '', 
          pageTitle: '', 
          pageUrl: '', 
          pageContent: '' 
        } 
      });
    }
  },

  // Output
  currentOutput: '',
  setCurrentOutput: (output) => set({ currentOutput: output }),
  isGenerating: false,
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  error: null,
  setError: (error) => set({ error }),

  syncWindowState: async (windowId) => {
    const state: WindowState = {
      panelOpen: true,
      activeView: get().activeView,
      selectedCard: get().selectedCard,
      isEditing: get().isEditing,
      pageContext: get().pageContext,
      currentOutput: get().currentOutput,
      isGenerating: get().isGenerating,
      error: get().error,
      draft: get().draft,
      editorScrollTop: get().editorScrollTop,
      editorSelection: get().editorSelection,
    };
    await storage.setWindowState(windowId, state);
  },

  loadWindowState: async (windowId) => {
    const state = await storage.getWindowState<WindowState>(windowId, await storage.getLastWindowState<WindowState>(defaultWindowState));
    set({
      activeView: state.panelOpen ? state.activeView : 'cards',
      selectedCard: state.selectedCard,
      isEditing: state.isEditing,
      pageContext: state.pageContext,
      currentOutput: state.currentOutput,
      isGenerating: state.isGenerating,
      error: state.error,
      draft: state.draft,
      editorScrollTop: state.editorScrollTop,
      editorSelection: state.editorSelection,
    });
  },

  setPanelOpen: async (open) => {
    const state: WindowState = {
      panelOpen: open,
      activeView: get().activeView,
      selectedCard: get().selectedCard,
      isEditing: get().isEditing,
      pageContext: get().pageContext,
      currentOutput: get().currentOutput,
      isGenerating: get().isGenerating,
      error: get().error,
      draft: get().draft,
      editorScrollTop: get().editorScrollTop,
      editorSelection: get().editorSelection,
    };
    const win = await chrome.windows.getCurrent();
    if (win?.id !== undefined) await storage.setWindowState(win.id, state);
  },
}));

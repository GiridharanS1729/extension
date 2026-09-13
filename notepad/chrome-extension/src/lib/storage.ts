import type { Settings, PromptCard, HistoryEntry, AIProvider, AIModel } from '@/types';

const STORAGE_KEYS = {
  SETTINGS: 'ai_sidebar_settings',
  PROMPT_CARDS: 'ai_sidebar_cards',
  HISTORY: 'ai_sidebar_history',
  LAST_OUTPUT: 'ai_sidebar_last_output',
  WINDOW_STATE: 'ai_sidebar_window_state',
  LAST_WINDOW_STATE: 'ai_sidebar_last_window_state',
} as const;

export const defaultSettings: Settings = {
  defaultModel: 'gpt-4o-mini',
  defaultProvider: 'openai',
  uiMode: 'popup',
  historySize: 50,
  theme: 'dark',
  providers: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      enabled: false,
      apiKey: '',
      models: ['gpt-4o-mini', 'gpt-4.1', 'gpt-3.5-turbo'],
      baseUrl: 'https://api.openai.com/v1',
    },
    gemini: {
      id: 'gemini',
      name: 'Google Gemini',
      enabled: false,
      apiKey: '',
      models: ['gemini-1.5-flash', 'gemini-1.5-pro'],
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    },
    groq: {
      id: 'groq',
      name: 'Groq',
      enabled: false,
      apiKey: '',
      models: ['llama-3.1-70b', 'mixtral-8x7b'],
      baseUrl: 'https://api.groq.com/openai/v1',
    },
    deepseek: {
      id: 'deepseek',
      name: 'DeepSeek',
      enabled: false,
      apiKey: '',
      models: ['deepseek-chat', 'deepseek-coder'],
      baseUrl: 'https://api.deepseek.com/v1',
    },
  },
};

export const defaultPromptCards: PromptCard[] = [
  {
    id: 'rephrase-professional',
    title: 'Rephrase Professional',
    description: 'Rewrite text in a professional tone',
    template: {
      system: 'You are a professional writing assistant.',
      instruction: 'Rephrase the following text in a professional tone:',
      tone: 'professional',
      maxWords: 100,
      rules: ['No greetings', 'No explanations', 'Output only the result'],
    },
    variables: ['selection'],
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'fix-grammar',
    title: 'Fix Grammar',
    description: 'Correct grammar and spelling errors',
    template: {
      system: 'You are a grammar correction assistant.',
      instruction: 'Fix all grammar and spelling errors in the following text:',
      tone: 'neutral',
      maxWords: 0,
      rules: ['Preserve original meaning', 'Only fix errors', 'Output corrected text only'],
    },
    variables: ['selection'],
    order: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'commit-message',
    title: 'Write Commit Message',
    description: 'Generate a git commit message',
    template: {
      system: 'You are a senior developer writing commit messages.',
      instruction: 'Write a concise git commit message for these changes:',
      tone: 'strict',
      maxWords: 50,
      rules: ['Use conventional commit format', 'Be concise', 'No explanations', 'Output only the commit message'],
    },
    variables: ['selection'],
    order: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'explain-code',
    title: 'Explain Code',
    description: 'Explain what the code does',
    template: {
      system: 'You are a helpful programming tutor.',
      instruction: 'Explain what this code does in simple terms:',
      tone: 'casual',
      maxWords: 200,
      rules: ['Be clear and concise', 'Use simple language'],
    },
    variables: ['selection'],
    order: 3,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'summarize-page',
    title: 'Summarize Page',
    description: 'Summarize the current page content',
    template: {
      system: 'You are a content summarization expert.',
      instruction: 'Summarize the main points of this page:',
      tone: 'neutral',
      maxWords: 150,
      rules: ['Focus on key points', 'Be concise', 'Use bullet points if helpful'],
    },
    variables: ['pageContent', 'pageTitle'],
    order: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'pr-title',
    title: 'Generate PR Title',
    description: 'Create a pull request title',
    template: {
      system: 'You are a developer creating PR titles.',
      instruction: 'Generate a clear PR title for these changes:',
      tone: 'professional',
      maxWords: 15,
      rules: ['Be descriptive', 'Keep it short', 'Output only the title'],
    },
    variables: ['selection'],
    order: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

class StorageService {
  private async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  // Settings
  async getSettings(): Promise<Settings> {
    return this.get(STORAGE_KEYS.SETTINGS, defaultSettings);
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.set(STORAGE_KEYS.SETTINGS, settings);
  }

  async updateProviderKey(provider: AIProvider, apiKey: string): Promise<void> {
    const settings = await this.getSettings();
    settings.providers[provider].apiKey = apiKey;
    settings.providers[provider].enabled = apiKey.length > 0;
    await this.saveSettings(settings);
  }

  async setDefaultModel(model: AIModel, provider: AIProvider): Promise<void> {
    const settings = await this.getSettings();
    settings.defaultModel = model;
    settings.defaultProvider = provider;
    await this.saveSettings(settings);
  }

  // Prompt Cards
  async getPromptCards(): Promise<PromptCard[]> {
    return this.get(STORAGE_KEYS.PROMPT_CARDS, defaultPromptCards);
  }

  async savePromptCards(cards: PromptCard[]): Promise<void> {
    await this.set(STORAGE_KEYS.PROMPT_CARDS, cards);
  }

  async addPromptCard(card: PromptCard): Promise<void> {
    const cards = await this.getPromptCards();
    cards.push(card);
    await this.savePromptCards(cards);
  }

  async updatePromptCard(card: PromptCard): Promise<void> {
    const cards = await this.getPromptCards();
    const index = cards.findIndex(c => c.id === card.id);
    if (index !== -1) {
      cards[index] = { ...card, updatedAt: Date.now() };
      await this.savePromptCards(cards);
    }
  }

  async deletePromptCard(cardId: string): Promise<void> {
    const cards = await this.getPromptCards();
    await this.savePromptCards(cards.filter(c => c.id !== cardId));
  }

  async reorderPromptCards(cardIds: string[]): Promise<void> {
    const cards = await this.getPromptCards();
    const reordered = cardIds.map((id, index) => {
      const card = cards.find(c => c.id === id);
      if (card) {
        return { ...card, order: index };
      }
      return null;
    }).filter(Boolean) as PromptCard[];
    await this.savePromptCards(reordered);
  }

  // History
  async getHistory(): Promise<HistoryEntry[]> {
    return this.get(STORAGE_KEYS.HISTORY, []);
  }

  async addHistoryEntry(entry: HistoryEntry): Promise<void> {
    const settings = await this.getSettings();
    let history = await this.getHistory();
    history.unshift(entry);
    if (history.length > settings.historySize) {
      history = history.slice(0, settings.historySize);
    }
    await this.set(STORAGE_KEYS.HISTORY, history);
  }

  async getCardHistory(cardId: string): Promise<HistoryEntry[]> {
    const history = await this.getHistory();
    return history.filter(h => h.cardId === cardId);
  }

  async clearCardHistory(cardId: string): Promise<void> {
    const history = await this.getHistory();
    await this.set(STORAGE_KEYS.HISTORY, history.filter(h => h.cardId !== cardId));
  }

  async clearAllHistory(): Promise<void> {
    await this.set(STORAGE_KEYS.HISTORY, []);
  }

  // Last output for clipboard shortcut
  async setLastOutput(output: string): Promise<void> {
    await this.set(STORAGE_KEYS.LAST_OUTPUT, output);
  }

  async getLastOutput(): Promise<string> {
    return this.get(STORAGE_KEYS.LAST_OUTPUT, '');
  }

  async getWindowState<T>(windowId: number, defaultValue: T): Promise<T> {
    const all = await this.get<Record<string, T>>(STORAGE_KEYS.WINDOW_STATE, {});
    return all[String(windowId)] ?? defaultValue;
  }

  async setWindowState<T>(windowId: number, value: T): Promise<void> {
    const all = await this.get<Record<string, T>>(STORAGE_KEYS.WINDOW_STATE, {});
    all[String(windowId)] = value;
    await this.set(STORAGE_KEYS.WINDOW_STATE, all);
    await this.set(STORAGE_KEYS.LAST_WINDOW_STATE, value);
  }

  async getLastWindowState<T>(defaultValue: T): Promise<T> {
    return this.get(STORAGE_KEYS.LAST_WINDOW_STATE, defaultValue);
  }
}

export const storage = new StorageService();

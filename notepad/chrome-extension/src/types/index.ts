// Type definitions for AI Prompt Sidebar

export type AIProvider = 'openai' | 'gemini' | 'groq' | 'deepseek';

export type OpenAIModel = 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
export type GeminiModel = 'gemini-1.5-flash' | 'gemini-1.5-pro';
export type GroqModel = 'llama-3.1-70b' | 'mixtral-8x7b';
export type DeepSeekModel = 'deepseek-chat' | 'deepseek-coder';

export type AIModel = OpenAIModel | GeminiModel | GroqModel | DeepSeekModel;

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  enabled: boolean;
  apiKey: string;
  models: AIModel[];
  baseUrl: string;
}

export type ToneType = 'professional' | 'casual' | 'neutral' | 'strict';

export interface PromptRules {
  noGreetings: boolean;
  noExplanation: boolean;
  outputOnlyResult: boolean;
  beConcise: boolean;
  customRules: string[];
}

export interface PromptTemplate {
  system: string;
  instruction: string;
  tone: ToneType;
  maxWords: number;
  rules: string[];
}

export interface PromptCard {
  id: string;
  title: string;
  description: string;
  template: PromptTemplate;
  variables: string[];
  modelOverride?: AIModel;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  id: string;
  cardId: string;
  input: string;
  output: string;
  model: AIModel;
  provider: AIProvider;
  timestamp: number;
  tokens?: {
    prompt: number;
    completion: number;
  };
}

export interface PageContext {
  selection: string;
  pageTitle: string;
  pageUrl: string;
  pageContent: string;
}

export interface Settings {
  defaultModel: AIModel;
  defaultProvider: AIProvider;
  providers: Record<AIProvider, ProviderConfig>;
  uiMode: 'popup' | 'sidepanel';
  historySize: number;
  theme: 'dark' | 'light' | 'system';
}

export interface CardDraft {
  title: string;
  description: string;
  system: string;
  instruction: string;
  tone: ToneType;
  maxWords: number;
  rules: string[];
  newRule: string;
  modelOverride: AIModel | '';
  variables: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: AIModel;
  provider: AIProvider;
  tokens?: {
    prompt: number;
    completion: number;
  };
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (response: AIResponse) => void;
  onError: (error: Error) => void;
}

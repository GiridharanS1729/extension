export type Role = 'user' | 'assistant' | 'system';
export type Theme = 'dark' | 'light' | 'system';
export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'groq' | 'mistral' | 'deepseek' | 'ollama' | 'lmstudio' | 'compatible';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: Role;
  content: string;
  createdAt: number;
  parentId?: string;
  attachments?: Attachment[];
  stopped?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  deletedAt?: number;
  providerId?: string;
}

export interface Provider {
  id: string;
  kind: ProviderKind;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

export interface Prompt {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  favorite: boolean;
}

export interface Settings {
  width: number;
  theme: Theme;
  accent: string;
  animations: boolean;
  fontSize: number;
  temperature: number;
  topP: number;
  maxTokens: number;
  streaming: boolean;
  autoCopy: boolean;
  autoScroll: boolean;
  developerMode: boolean;
}

export interface PageContext {
  title: string;
  url: string;
  selection: string;
  text: string;
  meta: Record<string, string>;
  codeBlocks: string[];
}

export interface StreamRequest {
  requestId: string;
  provider: Provider;
  messages: Pick<Message, 'role' | 'content'>[];
  settings: Settings;
}

export type StreamEvent =
  | { type: 'chunk'; requestId: string; content: string }
  | { type: 'done'; requestId: string }
  | { type: 'error'; requestId: string; error: string };

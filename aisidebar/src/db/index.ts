import Dexie, { type EntityTable } from 'dexie';
import type { Chat, Message, Prompt, Provider, Settings } from '../types';

class SidebarDatabase extends Dexie {
  chats!: EntityTable<Chat, 'id'>;
  messages!: EntityTable<Message, 'id'>;
  providers!: EntityTable<Provider, 'id'>;
  prompts!: EntityTable<Prompt, 'id'>;
  settings!: EntityTable<Settings & { id: string }, 'id'>;

  constructor() {
    super('developer-ai-sidebar');
    this.version(1).stores({
      chats: 'id, updatedAt, pinned, favorite, archived, deletedAt',
      messages: 'id, chatId, createdAt, [chatId+createdAt]',
      providers: 'id, kind, enabled',
      prompts: 'id, title, folder, favorite, *tags',
      settings: 'id',
    });
  }
}

export const db = new SidebarDatabase();

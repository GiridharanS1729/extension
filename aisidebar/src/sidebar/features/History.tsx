import { useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { Archive, CheckSquare, Copy, Download, Heart, MoreHorizontal, Pin, RotateCcw, Search, Square, Trash2, Upload } from 'lucide-react';
import { db } from '../../db';
import { useSidebarStore } from '../../store';
import type { Chat } from '../../types';
import { download, groupDate } from '../../utils';

const ChatActions = ({ chat }: { chat: Chat }) => {
  const updateChat = useSidebarStore((state) => state.updateChat);
  const duplicateChat = useSidebarStore((state) => state.duplicateChat);
  const deleteChats = useSidebarStore((state) => state.deleteChats);
  const exportChat = async () => {
    const messages = await db.messages.where('chatId').equals(chat.id).sortBy('createdAt');
    download(`${chat.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`, JSON.stringify({ chats: [chat], messages }, null, 2));
  };
  return (
    <div className="chat-actions">
      <button type="button" title={chat.pinned ? 'Unpin' : 'Pin'} onClick={(event) => { event.stopPropagation(); void updateChat(chat.id, { pinned: !chat.pinned }); }}><Pin /></button>
      <button type="button" title={chat.favorite ? 'Unfavorite' : 'Favorite'} onClick={(event) => { event.stopPropagation(); void updateChat(chat.id, { favorite: !chat.favorite }); }}><Heart /></button>
      <details onClick={(event) => event.stopPropagation()}><summary><MoreHorizontal /></summary><div>
        <button type="button" onClick={() => void duplicateChat(chat.id)}><Copy />Duplicate</button>
        <button type="button" onClick={() => void exportChat()}><Download />Export</button>
        <button type="button" onClick={() => void updateChat(chat.id, { archived: !chat.archived })}><Archive />{chat.archived ? 'Unarchive' : 'Archive'}</button>
        <button type="button" className="danger" onClick={() => void deleteChats([chat.id])}><Trash2 />Delete</button>
      </div></details>
    </div>
  );
};

export const History = () => {
  const chats = useSidebarStore((state) => state.chats);
  const setActiveChat = useSidebarStore((state) => state.setActiveChat);
  const updateChat = useSidebarStore((state) => state.updateChat);
  const deleteChats = useSidebarStore((state) => state.deleteChats);
  const importChats = useSidebarStore((state) => state.importChats);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'active' | 'favorites' | 'archived' | 'trash'>('active');
  const [selected, setSelected] = useState<string[]>([]);
  const importRef = useRef<HTMLInputElement>(null);
  const fuse = useMemo(() => new Fuse(chats, { keys: ['title'], threshold: 0.35 }), [chats]);
  const searched = query ? fuse.search(query).map(({ item }) => item) : chats;
  const visible = searched.filter((chat) => filter === 'trash' ? Boolean(chat.deletedAt) : !chat.deletedAt && (filter === 'archived' ? chat.archived : filter === 'favorites' ? chat.favorite : !chat.archived));
  const groups = visible.reduce<Record<string, Chat[]>>((result, chat) => {
    const key = groupDate(chat.updatedAt);
    (result[key] ??= []).push(chat);
    return result;
  }, {});

  const toggle = (id: string) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

  return (
    <section className="view history-view">
      <div className="view-heading"><div><h2>History</h2><p>{visible.length} conversations</p></div><div><button type="button" title="Import chats" onClick={() => importRef.current?.click()}><Upload /></button><input ref={importRef} type="file" accept="application/json" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (file) await importChats(await file.text()); }} /></div></div>
      <label className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" /></label>
      <div className="tabs">{(['active', 'favorites', 'archived', 'trash'] as const).map((item) => <button type="button" className={filter === item ? 'active' : ''} key={item} onClick={() => { setFilter(item); setSelected([]); }}>{item}</button>)}</div>
      {!!selected.length && <div className="bulk-bar"><span>{selected.length} selected</span>{filter === 'trash' && <button type="button" onClick={() => void Promise.all(selected.map((id) => updateChat(id, { deletedAt: undefined }))).then(() => setSelected([]))}><RotateCcw />Restore</button>}<button type="button" className="danger" onClick={() => void deleteChats(selected, filter === 'trash').then(() => setSelected([]))}><Trash2 />Delete{filter === 'trash' ? ' forever' : ''}</button></div>}
      <div className="history-list">
        {Object.entries(groups).map(([label, items]) => <section key={label}><h3>{label}</h3>{items.map((chat) => <div className={`chat-row ${selected.includes(chat.id) ? 'selected' : ''}`} key={chat.id} onClick={() => filter !== 'trash' && void setActiveChat(chat.id)}>
          <button type="button" className="select-chat" aria-label={`Select ${chat.title}`} onClick={(event) => { event.stopPropagation(); toggle(chat.id); }}>{selected.includes(chat.id) ? <CheckSquare /> : <Square />}</button>
          <div className="chat-summary"><strong>{chat.title}</strong><span>{new Date(chat.updatedAt).toLocaleString()}</span></div>
          {filter !== 'trash' && <ChatActions chat={chat} />}
        </div>)}</section>)}
        {!visible.length && <div className="empty-list"><Search /><p>No conversations found.</p></div>}
      </div>
    </section>
  );
};

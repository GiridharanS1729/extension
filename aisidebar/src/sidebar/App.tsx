import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ChevronDown, Command, Copy, Download, History as HistoryIcon, MessageSquarePlus, MoreHorizontal, PanelRightClose, Pencil, Pin, Settings as SettingsIcon, Sparkles, Star, Trash2 } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { db } from '../db';
import { useSidebarStore } from '../store';
import { download } from '../utils';
import { Composer } from './components/Composer';
import { MessageList } from './components/MessageList';

const CommandPalette = lazy(() => import('./components/CommandPalette').then((module) => ({ default: module.CommandPalette })));
const History = lazy(() => import('./features/History').then((module) => ({ default: module.History })));
const Prompts = lazy(() => import('./features/Prompts').then((module) => ({ default: module.Prompts })));
const Settings = lazy(() => import('./features/Settings').then((module) => ({ default: module.Settings })));

const Navigation = () => {
  const view = useSidebarStore((state) => state.view);
  const setView = useSidebarStore((state) => state.setView);
  const newChat = useSidebarStore((state) => state.newChat);
  const setCommandOpen = useSidebarStore((state) => state.setCommandOpen);
  return <nav className="main-nav" aria-label="Sidebar navigation">
    <button type="button" className={view === 'chat' ? 'active' : ''} onClick={() => void newChat()} title="New chat"><MessageSquarePlus /></button>
    <button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')} title="History"><HistoryIcon /></button>
    <button type="button" className={view === 'prompts' ? 'active' : ''} onClick={() => setView('prompts')} title="Prompt library"><Sparkles /></button>
    <button type="button" onClick={() => setCommandOpen(true)} title="Command palette"><Command /></button>
    <span />
    <button type="button" className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')} title="Settings"><SettingsIcon /></button>
  </nav>;
};

const ChatHeader = () => {
  const chats = useSidebarStore((state) => state.chats);
  const activeChatId = useSidebarStore((state) => state.activeChatId);
  const providers = useSidebarStore((state) => state.providers);
  const activeProviderId = useSidebarStore((state) => state.activeProviderId);
  const setProvider = useSidebarStore((state) => state.setProvider);
  const updateChat = useSidebarStore((state) => state.updateChat);
  const duplicateChat = useSidebarStore((state) => state.duplicateChat);
  const deleteChats = useSidebarStore((state) => state.deleteChats);
  const setView = useSidebarStore((state) => state.setView);
  const chat = chats.find(({ id }) => id === activeChatId);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(chat?.title ?? 'New chat');
  useEffect(() => setTitle(chat?.title ?? 'New chat'), [chat?.title]);
  const rename = () => { if (chat && title.trim()) void updateChat(chat.id, { title: title.trim() }); setRenaming(false); };
  const exportChat = async () => {
    if (!chat) return;
    const messages = await db.messages.where('chatId').equals(chat.id).sortBy('createdAt');
    download(`${chat.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`, JSON.stringify({ chats: [chat], messages }, null, 2));
  };
  return <header className="chat-header">
    <div className="chat-title" onDoubleClick={() => setRenaming(true)}>{renaming ? <input value={title} autoFocus onChange={(event) => setTitle(event.target.value)} onBlur={rename} onKeyDown={(event) => { if (event.key === 'Enter') rename(); if (event.key === 'Escape') setRenaming(false); }} /> : <><strong>{chat?.title ?? 'New chat'}</strong><button type="button" title="Rename" onClick={() => setRenaming(true)}><Pencil /></button></>}</div>
    <div className="header-actions">
      <label className="model-select"><Bot /><select value={activeProviderId} onChange={(event) => setProvider(event.target.value)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.model}</option>)}</select><ChevronDown /></label>
      {chat && <details><summary><MoreHorizontal /></summary><div>
        <button type="button" onClick={() => void updateChat(chat.id, { pinned: !chat.pinned })}><Pin />{chat.pinned ? 'Unpin' : 'Pin'}</button>
        <button type="button" onClick={() => void updateChat(chat.id, { favorite: !chat.favorite })}><Star />{chat.favorite ? 'Unfavorite' : 'Favorite'}</button>
        <button type="button" onClick={() => void duplicateChat(chat.id)}><Copy />Duplicate</button>
        <button type="button" onClick={() => void exportChat()}><Download />Export</button>
        <button type="button" className="danger" onClick={() => void deleteChats([chat.id]).then(() => setView('history'))}><Trash2 />Delete</button>
      </div></details>}
    </div>
  </header>;
};

const Sidebar = () => {
  const view = useSidebarStore((state) => state.view);
  const settings = useSidebarStore((state) => state.settings);
  const updateSettings = useSidebarStore((state) => state.updateSettings);
  const setOpen = useSidebarStore((state) => state.setOpen);
  const commandOpen = useSidebarStore((state) => state.commandOpen);
  const dragging = useRef(false);
  useEffect(() => {
    const move = (event: MouseEvent) => { if (dragging.current) void updateSettings({ width: Math.max(360, Math.min(720, window.innerWidth - event.clientX)) }); };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [updateSettings]);
  return <motion.aside className="sidebar" style={{ width: Math.min(settings.width, window.innerWidth) }} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: settings.animations ? 0.22 : 0 }}>
    <div className="resize" onMouseDown={() => { dragging.current = true; }} />
    <div className="brand"><div><Bot /><span>Developer AI</span></div><button type="button" title="Close sidebar" onClick={() => setOpen(false)}><PanelRightClose /></button></div>
    <div className="workspace"><Navigation /><main><Suspense fallback={<div className="view-loading"><span /><span /><span /></div>}>{view === 'chat' && <><ChatHeader /><MessageList /><Composer /></>}{view === 'history' && <History />}{view === 'prompts' && <Prompts onInsert={(content) => window.dispatchEvent(new CustomEvent('developer-ai-insert', { detail: content }))} />}{view === 'settings' && <Settings />}</Suspense></main></div>
    {commandOpen && <Suspense fallback={null}><CommandPalette /></Suspense>}
  </motion.aside>;
};

export const App = () => {
  const hydrated = useSidebarStore((state) => state.hydrated);
  const open = useSidebarStore((state) => state.open);
  const settings = useSidebarStore((state) => state.settings);
  const setOpen = useSidebarStore((state) => state.setOpen);
  const setView = useSidebarStore((state) => state.setView);
  const newChat = useSidebarStore((state) => state.newChat);
  const setCommandOpen = useSidebarStore((state) => state.setCommandOpen);
  const clearChat = useSidebarStore((state) => state.clearChat);
  const copyLast = useSidebarStore((state) => state.copyLast);
  const regenerate = useSidebarStore((state) => state.regenerate);
  useEffect(() => { void useSidebarStore.getState().hydrate(); }, []);
  useHotkeys('ctrl+shift+a, meta+shift+a', () => setOpen(!open), { preventDefault: true }, [open]);
  useHotkeys('ctrl+shift+p, meta+shift+p', () => setCommandOpen(true), { preventDefault: true });
  useHotkeys('ctrl+shift+o, meta+shift+o', () => void newChat(), { preventDefault: true });
  useHotkeys('ctrl+shift+k, meta+shift+k', () => void clearChat(), { preventDefault: true });
  useHotkeys('ctrl+shift+h, meta+shift+h', () => setView('history'), { preventDefault: true });
  useHotkeys('ctrl+shift+s, meta+shift+s', () => setView('settings'), { preventDefault: true });
  useHotkeys('ctrl+shift+l, meta+shift+l', () => setView('prompts'), { preventDefault: true });
  useHotkeys('ctrl+shift+c, meta+shift+c', () => void copyLast(), { preventDefault: true });
  useHotkeys('ctrl+shift+r, meta+shift+r', () => void regenerate(), { preventDefault: true });
  useHotkeys('esc', () => open ? setOpen(false) : setCommandOpen(false), { enableOnFormTags: true }, [open]);
  if (!hydrated) return null;
  const theme = settings.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : settings.theme;
  return <div className={`developer-ai-root ${theme} ${settings.animations ? '' : 'no-motion'}`} style={{ '--accent': settings.accent, '--font-size': `${settings.fontSize}px` } as React.CSSProperties}>
    <AnimatePresence>{open && <Sidebar />}</AnimatePresence>
    {!open && <motion.button type="button" className="floating-button" title="Open Developer AI" aria-label="Open Developer AI" onClick={() => setOpen(true)} initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}><Bot /><span>Spark</span></motion.button>}
  </div>;
};

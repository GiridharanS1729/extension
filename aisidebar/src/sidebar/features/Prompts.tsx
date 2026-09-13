import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { Heart, Plus, Search, Trash2 } from 'lucide-react';
import { useSidebarStore } from '../../store';
import type { Prompt } from '../../types';
import { uid } from '../../utils';

const resolveVariables = (content: string) => content.replace(/{{\s*([^}]+)\s*}}/g, (_, name: string) => window.prompt(`Value for ${name.trim()}`) ?? `{{${name.trim()}}}`);

export const Prompts = ({ onInsert }: { onInsert: (content: string) => void }) => {
  const prompts = useSidebarStore((state) => state.prompts);
  const savePrompt = useSidebarStore((state) => state.savePrompt);
  const deletePrompt = useSidebarStore((state) => state.deletePrompt);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Prompt>();
  const fuse = useMemo(() => new Fuse(prompts, { keys: ['title', 'content', 'folder', 'tags'], threshold: 0.35 }), [prompts]);
  const visible = query ? fuse.search(query).map(({ item }) => item) : prompts;

  const create = () => setEditing({ id: uid(), title: '', content: '', folder: 'General', tags: [], favorite: false });

  return (
    <section className="view prompts-view">
      <div className="view-heading"><div><h2>Prompt Library</h2><p>Reusable prompts and templates</p></div><button type="button" className="primary" onClick={create}><Plus />New</button></div>
      <label className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search prompts, tags, folders" /></label>
      {editing && <form className="prompt-editor" onSubmit={(event) => { event.preventDefault(); if (editing.title.trim() && editing.content.trim()) void savePrompt(editing).then(() => setEditing(undefined)); }}>
        <input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} placeholder="Prompt title" autoFocus />
        <div><input value={editing.folder} onChange={(event) => setEditing({ ...editing, folder: event.target.value })} placeholder="Folder" /><input value={editing.tags.join(', ')} onChange={(event) => setEditing({ ...editing, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder="Tags, comma separated" /></div>
        <textarea value={editing.content} onChange={(event) => setEditing({ ...editing, content: event.target.value })} placeholder="Use {{variable}} for dynamic values" />
        <div className="form-actions"><button type="button" onClick={() => setEditing(undefined)}>Cancel</button><button type="submit" className="primary">Save prompt</button></div>
      </form>}
      <div className="prompt-grid">{visible.map((prompt) => <article key={prompt.id}>
        <div><span>{prompt.folder}</span><button type="button" title="Favorite" onClick={() => void savePrompt({ ...prompt, favorite: !prompt.favorite })}><Heart fill={prompt.favorite ? 'currentColor' : 'none'} /></button></div>
        <h3>{prompt.title}</h3><p>{prompt.content}</p>
        <div className="tags">{prompt.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        <footer><button type="button" onClick={() => setEditing(prompt)}>Edit</button><button type="button" onClick={() => { onInsert(resolveVariables(prompt.content)); useSidebarStore.getState().setView('chat'); }}>Insert</button><button type="button" className="danger" title="Delete" onClick={() => void deletePrompt(prompt.id)}><Trash2 /></button></footer>
      </article>)}</div>
      {!visible.length && !editing && <div className="empty-list"><p>No saved prompts yet.</p><button type="button" className="primary" onClick={create}>Create your first prompt</button></div>}
    </section>
  );
};

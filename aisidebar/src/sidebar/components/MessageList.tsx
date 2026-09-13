import { memo, useState } from 'react';
import { Check, Copy, Pencil, RefreshCw } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useSidebarStore } from '../../store';
import type { Message } from '../../types';
import { formatTime } from '../../utils';
import { Markdown } from './Markdown';

const MessageItem = memo(({ message }: { message: Message }) => {
  const updateMessage = useSidebarStore((state) => state.updateMessage);
  const regenerate = useSidebarStore((state) => state.regenerate);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const save = async () => {
    await updateMessage(message.id, draft.trim());
    setEditing(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <article className={`message ${message.role}`}>
      <div className="message-meta"><strong>{message.role === 'user' ? 'You' : 'AI'}</strong><time>{formatTime(message.createdAt)}</time>{message.stopped && <span>Stopped</span>}</div>
      {editing ? (
        <div className="message-editor">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
          <div><button type="button" onClick={() => setEditing(false)}>Cancel</button><button type="button" className="primary" onClick={() => void save()}>Save</button></div>
        </div>
      ) : <div className="message-content"><Markdown>{message.content || '▍'}</Markdown></div>}
      {!editing && message.content && (
        <div className="message-actions">
          <button type="button" onClick={copy}>{copied ? <Check /> : <Copy />}<span>{copied ? 'Copied' : 'Copy'}</span></button>
          <button type="button" onClick={() => setEditing(true)}><Pencil /><span>Edit</span></button>
          {message.role === 'assistant' && <button type="button" onClick={() => void regenerate()}><RefreshCw /><span>Regenerate</span></button>}
        </div>
      )}
    </article>
  );
});

export const MessageList = () => {
  const messages = useSidebarStore((state) => state.messages);
  const settings = useSidebarStore((state) => state.settings);
  if (!messages.length) return (
    <div className="empty-chat">
      <div className="empty-orb">AI</div>
      <h2>What are you building?</h2>
      <p>Ask about this page, paste code, attach files, or run a developer command.</p>
      <div className="suggestions">
        {['Explain the selected code', 'Find bugs on this page', 'Summarize this page', 'Write a commit message'].map((item) => <button type="button" key={item} onClick={() => void useSidebarStore.getState().send(item)}>{item}</button>)}
      </div>
    </div>
  );
  return (
    <Virtuoso
      className="messages"
      data={messages}
      followOutput={settings.autoScroll ? 'smooth' : false}
      initialTopMostItemIndex={messages.length - 1}
      itemContent={(_, message) => <MessageItem message={message} />}
    />
  );
};

import { useEffect, useRef, useState } from 'react';
import { AtSign, FileText, Globe2, Paperclip, Send, Square, X } from 'lucide-react';
import { useSidebarStore } from '../../store';
import type { Attachment } from '../../types';
import { pageContext, uid } from '../../utils';

const readFile = (file: File): Promise<Attachment> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error ?? new Error('Unable to read file.'));
  reader.onload = () => resolve({ id: uid(), name: file.name, type: file.type, size: file.size, content: String(reader.result) });
  if (file.type.startsWith('image/')) reader.readAsDataURL(file);
  else reader.readAsText(file);
});

export const Composer = () => {
  const send = useSidebarStore((state) => state.send);
  const stop = useSidebarStore((state) => state.stop);
  const generating = useSidebarStore((state) => state.generating);
  const error = useSidebarStore((state) => state.error);
  const provider = useSidebarStore((state) => state.providers.find(({ id }) => id === state.activeProviderId));
  const messages = useSidebarStore((state) => state.messages);
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const insert = (event: Event) => setValue((current) => `${current}${current ? '\n\n' : ''}${(event as CustomEvent<string>).detail}`);
    window.addEventListener('developer-ai-insert', insert);
    return () => window.removeEventListener('developer-ai-insert', insert);
  }, []);

  const submit = async () => {
    if (!value.trim() && !attachments.length) return;
    const current = value;
    const files = attachments;
    setValue('');
    setAttachments([]);
    await send(current, files);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter((file) => file.size <= 10 * 1024 * 1024);
    const added = await Promise.all(valid.map(readFile));
    setAttachments((current) => [...current, ...added]);
  };

  const addContext = (kind: 'page' | 'selection') => {
    const context = pageContext();
    const text = kind === 'selection' ? context.selection : `Title: ${context.title}\nURL: ${context.url}\n\n${context.text}`;
    setValue((current) => `${current}${current ? '\n\n' : ''}${kind === 'selection' ? 'Explain this selection:' : 'Use this page as context:'}\n${text}`);
  };

  const counts = { characters: value.length, words: value.trim() ? value.trim().split(/\s+/).length : 0, tokens: Math.ceil(value.length / 4) };

  return (
    <footer className="composer-wrap" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}>
      {error && <div className="composer-error" role="alert">{error}</div>}
      {!!attachments.length && <div className="attachments">{attachments.map((file) => <span key={file.id}><FileText />{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments((current) => current.filter(({ id }) => id !== file.id))}><X /></button></span>)}</div>}
      <div className="composer">
        <textarea
          value={value}
          aria-label="Message"
          placeholder={`Message ${provider?.name ?? 'AI'}…`}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' && !event.shiftKey) || (event.key === 'Enter' && event.altKey)) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className="composer-tools">
          <div>
            <button type="button" title="Attach files" onClick={() => fileRef.current?.click()}><Paperclip /></button>
            <button type="button" title="Add page" onClick={() => addContext('page')}><Globe2 /></button>
            <button type="button" title="Add selection" onClick={() => addContext('selection')}><AtSign /></button>
            <input ref={fileRef} type="file" multiple hidden onChange={(event) => void addFiles(event.target.files)} accept="image/*,.pdf,.md,.json,.csv,.txt,.js,.jsx,.ts,.tsx,.py,.html,.css,.sql" />
          </div>
          <div className="counts" title={`${counts.characters} characters · ${counts.words} words`}>~{counts.tokens} tokens</div>
          <button type="button" className="send" aria-label={generating ? 'Stop generation' : 'Send message'} onClick={generating ? stop : () => void submit()} disabled={!generating && !value.trim() && !attachments.length}>{generating ? <Square /> : <Send />}</button>
        </div>
      </div>
      <div className="conversation-count">{messages.length} messages</div>
    </footer>
  );
};

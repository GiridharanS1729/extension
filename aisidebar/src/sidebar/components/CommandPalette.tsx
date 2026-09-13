import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { Code2, FileText, History, MessageSquarePlus, Search, Settings, Sparkles, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSidebarStore } from '../../store';
import { pageContext } from '../../utils';

interface Command {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  run: () => void;
}

export const CommandPalette = () => {
  const setOpen = useSidebarStore((state) => state.setCommandOpen);
  const setView = useSidebarStore((state) => state.setView);
  const newChat = useSidebarStore((state) => state.newChat);
  const send = useSidebarStore((state) => state.send);
  const [query, setQuery] = useState('');
  const commands = useMemo<Command[]>(() => {
    const contextual = (label: string, prompt: string): Command => ({ id: label, label, group: 'Developer tools', icon: <Code2 />, run: () => void send(`${prompt}\n\nPage: ${pageContext().url}\nSelected content:\n${pageContext().selection || pageContext().codeBlocks.join('\n\n')}`) });
    return [
      { id: 'new', label: 'New chat', group: 'Navigation', icon: <MessageSquarePlus />, run: () => void newChat() },
      { id: 'history', label: 'Open history', group: 'Navigation', icon: <History />, run: () => setView('history') },
      { id: 'prompts', label: 'Open prompt library', group: 'Navigation', icon: <FileText />, run: () => setView('prompts') },
      { id: 'settings', label: 'Open settings', group: 'Navigation', icon: <Settings />, run: () => setView('settings') },
      contextual('Explain code', 'Explain this code clearly, including its behavior and important tradeoffs.'),
      contextual('Find bugs', 'Find correctness bugs, edge cases, and likely failures. Prioritize by severity.'),
      contextual('Refactor code', 'Refactor this code while preserving behavior. Return the improved code and concise rationale.'),
      contextual('Optimize performance', 'Analyze and optimize this code for performance without changing behavior.'),
      contextual('Generate tests', 'Generate comprehensive tests for this code, including edge cases.'),
      contextual('Convert JavaScript to TypeScript', 'Convert this JavaScript to strict, idiomatic TypeScript with no any types.'),
      contextual('Security audit', 'Perform a security audit and provide concrete remediations.'),
      contextual('Accessibility audit', 'Audit this interface for WCAG accessibility issues and provide fixes.'),
      contextual('Explain stack trace', 'Explain this stack trace, identify the root cause, and propose a fix.'),
      contextual('Generate documentation', 'Generate concise developer documentation for this code.'),
      { id: 'summary', label: 'Summarize page', group: 'Page context', icon: <Sparkles />, run: () => void send(`Summarize this page:\n\n${pageContext().title}\n${pageContext().url}\n\n${pageContext().text}`) },
      { id: 'translate', label: 'Translate selection', group: 'Page context', icon: <Sparkles />, run: () => void send(`Translate this selection to English, preserving tone:\n\n${pageContext().selection}`) },
      { id: 'grammar', label: 'Fix grammar', group: 'Page context', icon: <Sparkles />, run: () => void send(`Fix the grammar and clarity of this text. Return only the revised text:\n\n${pageContext().selection}`) },
    ];
  }, [newChat, send, setView]);
  const fuse = useMemo(() => new Fuse(commands, { keys: ['label', 'group'], threshold: 0.35 }), [commands]);
  const visible = query ? fuse.search(query).map(({ item }) => item) : commands;
  const run = (command: Command) => { command.run(); setOpen(false); };

  return (
    <div className="palette-backdrop" onMouseDown={() => setOpen(false)}>
      <motion.section className="palette" initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette">
        <label><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a command…" onKeyDown={(event) => { if (event.key === 'Enter' && visible[0]) run(visible[0]); if (event.key === 'Escape') setOpen(false); }} /><button type="button" onClick={() => setOpen(false)}><X /></button></label>
        <div>{visible.map((command) => <button type="button" key={command.id} onClick={() => run(command)}><span>{command.icon}</span><strong>{command.label}</strong><small>{command.group}</small></button>)}{!visible.length && <p>No matching commands</p>}</div>
        <footer><span><kbd>↵</kbd> Run</span><span><kbd>esc</kbd> Close</span></footer>
      </motion.section>
    </div>
  );
};

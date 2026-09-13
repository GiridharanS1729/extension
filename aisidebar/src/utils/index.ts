import type { PageContext } from '../types';

export const uid = () => crypto.randomUUID();

export const formatTime = (value: number) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(value);

export const groupDate = (value: number) => {
  const now = new Date();
  const date = new Date(value);
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Last 7 Days';
  if (days < 30) return 'Last 30 Days';
  return 'Older';
};

export const pageContext = (): PageContext => ({
  title: document.title,
  url: location.href,
  selection: getSelection()?.toString().trim() ?? '',
  text: document.body.innerText.slice(0, 30_000),
  meta: Object.fromEntries(Array.from(document.querySelectorAll('meta[name],meta[property]')).map((element) => {
    const meta = element as HTMLMetaElement;
    return [meta.name || meta.getAttribute('property') || '', meta.content];
  }).filter(([key]) => key)),
  codeBlocks: Array.from(document.querySelectorAll('pre, code')).map((element) => element.textContent ?? '').filter(Boolean).slice(0, 20),
});

export const download = (name: string, content: string, type = 'application/json') => {
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([content], { type }));
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};

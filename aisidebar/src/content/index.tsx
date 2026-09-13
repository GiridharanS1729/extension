import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../sidebar/App';
import { useSidebarStore } from '../store';
import styles from '../styles/index.css?inline';

const runtimeWindow = window as Window & { __developerAISidebarLoaded?: boolean };

if (!runtimeWindow.__developerAISidebarLoaded) {
  runtimeWindow.__developerAISidebarLoaded = true;
  const host = document.createElement('div');
  host.id = 'developer-ai-sidebar-host';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  const mount = document.createElement('div');
  shadow.append(style, mount);
  document.documentElement.append(host);

  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 2 } } });
  createRoot(mount).render(<StrictMode><QueryClientProvider client={client}><MemoryRouter><App /></MemoryRouter></QueryClientProvider></StrictMode>);

  chrome.runtime.onMessage.addListener((message: { type?: string; selection?: string; open?: boolean }) => {
    if (message.type === 'toggle-sidebar') useSidebarStore.getState().setOpen(!useSidebarStore.getState().open);
    if (message.type === 'sidebar-open-state' && typeof message.open === 'boolean') useSidebarStore.setState({ open: message.open });
    if (message.type === 'explain-selection') {
      useSidebarStore.getState().setOpen(true);
      window.dispatchEvent(new CustomEvent('developer-ai-insert', { detail: `Explain this selection:\n\n${message.selection ?? ''}` }));
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    const open = changes.sidebarOpen?.newValue;
    if (areaName === 'local' && typeof open === 'boolean') useSidebarStore.setState({ open });
  });
}

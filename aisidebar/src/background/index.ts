import type { Provider, StreamEvent, StreamRequest } from '../types';

const controllers = new Map<string, AbortController>();

const trimSlash = (value: string) => value.replace(/\/$/, '');

const endpointFor = (provider: Provider) => {
  const base = trimSlash(provider.baseUrl);
  if (provider.kind === 'gemini') return `${base}/${provider.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(provider.apiKey)}`;
  if (provider.kind === 'anthropic') return `${base}/messages`;
  return `${base}/chat/completions`;
};

const requestFor = ({ provider, messages, settings }: StreamRequest): RequestInit => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.kind === 'anthropic') {
    headers['x-api-key'] = provider.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    return {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: provider.model, messages: messages.filter(({ role }) => role !== 'system'), system: messages.find(({ role }) => role === 'system')?.content, max_tokens: settings.maxTokens, temperature: settings.temperature, top_p: settings.topP, stream: settings.streaming }),
    };
  }
  if (provider.kind === 'gemini') {
    return {
      method: 'POST',
      headers,
      body: JSON.stringify({ contents: messages.filter(({ role }) => role !== 'system').map(({ role, content }) => ({ role: role === 'assistant' ? 'model' : 'user', parts: [{ text: content }] })), systemInstruction: messages.find(({ role }) => role === 'system') ? { parts: [{ text: messages.find(({ role }) => role === 'system')?.content }] } : undefined, generationConfig: { temperature: settings.temperature, topP: settings.topP, maxOutputTokens: settings.maxTokens } }),
    };
  }
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
  if (provider.kind === 'openrouter') {
    headers['HTTP-Referer'] = 'https://developer-ai-sidebar.local';
    headers['X-Title'] = 'Developer AI Sidebar';
  }
  return {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: provider.model, messages, temperature: settings.temperature, top_p: settings.topP, max_tokens: settings.maxTokens, stream: settings.streaming }),
  };
};

const contentFrom = (provider: Provider, payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return '';
  if (provider.kind === 'anthropic') {
    const event = payload as { delta?: { text?: string }; content?: Array<{ text?: string }> };
    return event.delta?.text ?? event.content?.[0]?.text ?? '';
  }
  if (provider.kind === 'gemini') {
    const event = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return event.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
  const event = payload as { choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }> };
  return event.choices?.[0]?.delta?.content ?? event.choices?.[0]?.message?.content ?? '';
};

const stream = async (port: chrome.runtime.Port, request: StreamRequest) => {
  const controller = new AbortController();
  controllers.set(request.requestId, controller);
  const send = (event: StreamEvent) => port.postMessage(event);
  try {
    const response = await fetch(endpointFor(request.provider), { ...requestFor(request), signal: controller.signal });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`);
    }
    if (!request.settings.streaming) {
      send({ type: 'chunk', requestId: request.requestId, content: contentFrom(request.provider, await response.json()) });
      send({ type: 'done', requestId: request.requestId });
      return;
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('The provider returned an empty response.');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        for (const line of part.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const content = contentFrom(request.provider, JSON.parse(data));
            if (content) send({ type: 'chunk', requestId: request.requestId, content });
          } catch {}
        }
      }
      if (done) break;
    }
    send({ type: 'done', requestId: request.requestId });
  } catch (error) {
    if (!controller.signal.aborted) send({ type: 'error', requestId: request.requestId, error: error instanceof Error ? error.message : 'Request failed.' });
  } finally {
    controllers.delete(request.requestId);
  }
};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'developer-ai-stream') return;
  port.onMessage.addListener((message: StreamRequest | { type: 'abort'; requestId: string }) => {
    if ('type' in message && message.type === 'abort') controllers.get(message.requestId)?.abort();
    else void stream(port, message as StreamRequest);
  });
});

chrome.runtime.onMessage.addListener((message: { type?: string; provider?: Provider }, _sender, respond) => {
  if (message.type !== 'test-provider' || !message.provider) return;
  const provider = message.provider;
  const headers: Record<string, string> = {};
  if (provider.kind === 'anthropic') {
    headers['x-api-key'] = provider.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
  const base = trimSlash(provider.baseUrl);
  const url = provider.kind === 'gemini' ? `${base}?key=${encodeURIComponent(provider.apiKey)}` : `${base}/models`;
  void fetch(url, { headers }).then((response) => respond({ ok: response.ok })).catch(() => respond({ ok: false }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'developer-ai-explain', title: 'Explain with Developer AI', contexts: ['selection'] });
});

const sendToTab = async (tabId: number, message: { type: string; selection?: string; open?: boolean }) => {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    const scripts = chrome.runtime.getManifest().content_scripts?.flatMap(({ js = [] }) => js) ?? [];
    if (!scripts.length) return;
    await chrome.scripting.executeScript({ target: { tabId }, files: scripts });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        await chrome.tabs.sendMessage(tabId, message);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
};

const setGlobalOpen = async (open: boolean) => {
  await chrome.storage.local.set({ sidebarOpen: open });
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter(({ id }) => id !== undefined).map(({ id }) => sendToTab(id as number, { type: 'sidebar-open-state', open })));
};

const toggleOnActiveTab = async () => {
  const { sidebarOpen = false } = await chrome.storage.local.get('sidebarOpen') as { sidebarOpen?: boolean };
  await setGlobalOpen(!sidebarOpen);
};

chrome.runtime.onMessage.addListener((message: { type?: string; open?: boolean }, _sender, respond) => {
  if (message.type !== 'set-sidebar-open' || typeof message.open !== 'boolean') return;
  void setGlobalOpen(message.open).then(() => respond({ ok: true })).catch(() => respond({ ok: false }));
  return true;
});

chrome.action.onClicked.addListener(toggleOnActiveTab);
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-sidebar') void toggleOnActiveTab();
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'developer-ai-explain' && tab?.id) void setGlobalOpen(true).then(() => sendToTab(tab.id as number, { type: 'explain-selection', selection: info.selectionText ?? '' }));
});

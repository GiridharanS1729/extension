import type { StreamEvent, StreamRequest } from '../types';

export const streamCompletion = (request: StreamRequest, onEvent: (event: StreamEvent) => void) => {
  const port = chrome.runtime.connect({ name: 'developer-ai-stream' });
  port.onMessage.addListener(onEvent);
  port.postMessage(request);
  return () => {
    port.postMessage({ type: 'abort', requestId: request.requestId });
    port.disconnect();
  };
};

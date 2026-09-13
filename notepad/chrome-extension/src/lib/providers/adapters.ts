import type { AIProvider, AIModel, ChatMessage, AIResponse, StreamCallbacks } from '@/types';

export interface ProviderAdapter {
  provider: AIProvider;
  chat(messages: ChatMessage[], model: AIModel, apiKey: string): Promise<AIResponse>;
  streamChat(messages: ChatMessage[], model: AIModel, apiKey: string, callbacks: StreamCallbacks): Promise<void>;
}

// OpenAI Adapter
export const openaiAdapter: ProviderAdapter = {
  provider: 'openai',

  async chat(messages, model, apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model,
      provider: 'openai',
      tokens: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
      },
    };
  },

  async streamChat(messages, model, apiKey, callbacks) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      callbacks.onError(new Error(error.error?.message || 'OpenAI API error'));
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (!reader) {
      callbacks.onError(new Error('No response body'));
      return;
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices[0]?.delta?.content || '';
            if (token) {
              fullContent += token;
              callbacks.onToken(token);
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }

      callbacks.onComplete({
        content: fullContent,
        model,
        provider: 'openai',
      });
    } catch (error) {
      callbacks.onError(error as Error);
    }
  },
};

// Gemini Adapter
export const geminiAdapter: ProviderAdapter = {
  provider: 'gemini',

  async chat(messages, model, apiKey) {
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find(m => m.role === 'system')?.content;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    return {
      content: data.candidates[0].content.parts[0].text,
      model,
      provider: 'gemini',
    };
  },

  async streamChat(messages, model, apiKey, callbacks) {
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find(m => m.role === 'system')?.content;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      callbacks.onError(new Error(error.error?.message || 'Gemini API error'));
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (!reader) {
      callbacks.onError(new Error('No response body'));
      return;
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            const token = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (token) {
              fullContent += token;
              callbacks.onToken(token);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      callbacks.onComplete({
        content: fullContent,
        model,
        provider: 'gemini',
      });
    } catch (error) {
      callbacks.onError(error as Error);
    }
  },
};

// Groq Adapter (OpenAI-compatible API)
export const groqAdapter: ProviderAdapter = {
  provider: 'groq',

  async chat(messages, model, apiKey) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Groq API error');
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model,
      provider: 'groq',
      tokens: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
      },
    };
  },

  async streamChat(messages, model, apiKey, callbacks) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      callbacks.onError(new Error(error.error?.message || 'Groq API error'));
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (!reader) {
      callbacks.onError(new Error('No response body'));
      return;
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices[0]?.delta?.content || '';
            if (token) {
              fullContent += token;
              callbacks.onToken(token);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      callbacks.onComplete({
        content: fullContent,
        model,
        provider: 'groq',
      });
    } catch (error) {
      callbacks.onError(error as Error);
    }
  },
};

// DeepSeek Adapter (OpenAI-compatible API)
export const deepseekAdapter: ProviderAdapter = {
  provider: 'deepseek',

  async chat(messages, model, apiKey) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'DeepSeek API error');
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model,
      provider: 'deepseek',
      tokens: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
      },
    };
  },

  async streamChat(messages, model, apiKey, callbacks) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      callbacks.onError(new Error(error.error?.message || 'DeepSeek API error'));
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (!reader) {
      callbacks.onError(new Error('No response body'));
      return;
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices[0]?.delta?.content || '';
            if (token) {
              fullContent += token;
              callbacks.onToken(token);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      callbacks.onComplete({
        content: fullContent,
        model,
        provider: 'deepseek',
      });
    } catch (error) {
      callbacks.onError(error as Error);
    }
  },
};

export const adapters: Record<AIProvider, ProviderAdapter> = {
  openai: openaiAdapter,
  gemini: geminiAdapter,
  groq: groqAdapter,
  deepseek: deepseekAdapter,
};

export function getProviderForModel(model: AIModel): AIProvider {
  if (['gpt-4o-mini', 'gpt-4.1', 'gpt-3.5-turbo'].includes(model)) return 'openai';
  if (['gemini-1.5-flash', 'gemini-1.5-pro'].includes(model)) return 'gemini';
  if (['llama-3.1-70b', 'mixtral-8x7b'].includes(model)) return 'groq';
  if (['deepseek-chat', 'deepseek-coder'].includes(model)) return 'deepseek';
  return 'openai';
}

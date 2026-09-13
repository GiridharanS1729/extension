import type { 
  AIProvider, 
  AIModel, 
  ChatMessage, 
  AIResponse, 
  StreamCallbacks, 
  PromptCard, 
  PromptTemplate,
  PageContext 
} from '@/types';
import { storage } from './storage';
import { adapters, getProviderForModel } from './providers/adapters';

class PromptEngine {
  private buildSystemPrompt(template: PromptTemplate): string {
    const parts: string[] = [];

    if (template.system) {
      parts.push(template.system);
    }

    // Add tone instruction
    const toneInstructions: Record<string, string> = {
      professional: 'Use a professional and formal tone.',
      casual: 'Use a casual and friendly tone.',
      neutral: 'Use a neutral and objective tone.',
      strict: 'Be strict and precise. Follow instructions exactly.',
    };
    parts.push(toneInstructions[template.tone]);

    // Add word limit
    if (template.maxWords > 0) {
      parts.push(`Keep your response under ${template.maxWords} words.`);
    }

    // Add rules
    if (template.rules.length > 0) {
      parts.push('\nRules to follow:');
      template.rules.forEach(rule => {
        parts.push(`- ${rule}`);
      });
    }

    return parts.join('\n');
  }

  private interpolateVariables(text: string, context: PageContext): string {
    return text
      .replace(/\{\{selection\}\}/g, context.selection || '')
      .replace(/\{\{pageTitle\}\}/g, context.pageTitle || '')
      .replace(/\{\{pageUrl\}\}/g, context.pageUrl || '')
      .replace(/\{\{pageContent\}\}/g, context.pageContent || '');
  }

  buildMessages(card: PromptCard, input: string, context: PageContext): ChatMessage[] {
    const systemPrompt = this.buildSystemPrompt(card.template);
    const instruction = this.interpolateVariables(card.template.instruction, context);

    const userContent = input 
      ? `${instruction}\n\n${input}`
      : `${instruction}\n\n${context.selection || context.pageContent || ''}`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];
  }

  async executeCard(
    card: PromptCard, 
    input: string, 
    context: PageContext,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const settings = await storage.getSettings();
    const messages = this.buildMessages(card, input, context);

    // Determine model and provider
    const model = card.modelOverride || settings.defaultModel;
    const provider = getProviderForModel(model);
    const providerConfig = settings.providers[provider];

    if (!providerConfig.enabled || !providerConfig.apiKey) {
      // Try fallback providers
      const fallbackOrder: AIProvider[] = ['openai', 'gemini', 'groq', 'deepseek'];
      let fallbackFound = false;

      for (const fallbackProvider of fallbackOrder) {
        const fallbackConfig = settings.providers[fallbackProvider];
        if (fallbackConfig.enabled && fallbackConfig.apiKey) {
          const fallbackModel = fallbackConfig.models[0];
          await this.executeWithProvider(
            fallbackProvider,
            fallbackModel,
            fallbackConfig.apiKey,
            messages,
            callbacks
          );
          fallbackFound = true;
          break;
        }
      }

      if (!fallbackFound) {
        callbacks.onError(new Error('No API keys configured. Please add at least one API key in settings.'));
      }
      return;
    }

    await this.executeWithProvider(provider, model, providerConfig.apiKey, messages, callbacks);
  }

  private async executeWithProvider(
    provider: AIProvider,
    model: AIModel,
    apiKey: string,
    messages: ChatMessage[],
    callbacks: StreamCallbacks
  ): Promise<void> {
    const adapter = adapters[provider];

    try {
      await adapter.streamChat(messages, model, apiKey, callbacks);
    } catch (error) {
      callbacks.onError(error as Error);
    }
  }

  async executeRephrase(
    text: string,
    tone: string,
    maxWords: number,
    rules: string[],
    callbacks: StreamCallbacks
  ): Promise<void> {
    const settings = await storage.getSettings();
    const model = settings.defaultModel;
    const provider = getProviderForModel(model);
    const providerConfig = settings.providers[provider];

    const systemPrompt = [
      'You are a text rephrasing assistant.',
      `Use a ${tone} tone.`,
      maxWords > 0 ? `Keep your response under ${maxWords} words.` : '',
      ...rules.map(r => `- ${r}`),
    ].filter(Boolean).join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Rephrase the following text:\n\n${text}` },
    ];

    if (!providerConfig.enabled || !providerConfig.apiKey) {
      // Find any enabled provider
      for (const [key, config] of Object.entries(settings.providers)) {
        if (config.enabled && config.apiKey) {
          await this.executeWithProvider(
            key as AIProvider,
            config.models[0],
            config.apiKey,
            messages,
            callbacks
          );
          return;
        }
      }
      callbacks.onError(new Error('No API keys configured.'));
      return;
    }

    await this.executeWithProvider(provider, model, providerConfig.apiKey, messages, callbacks);
  }
}

export const promptEngine = new PromptEngine();

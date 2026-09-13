import { callOpenAI } from "./openai.js";
import { callGemini } from "./gemini.js";

export async function generate(provider, keys, messages) {
    try {
        if (provider === "openai") {
            return await callOpenAI(keys.openai, messages);
        }
        return await callGemini(keys.gemini, messages.map(m => m.content).join("\n"));
    } catch {
        if (provider === "openai") {
            return await callGemini(keys.gemini, messages.map(m => m.content).join("\n"));
        }
        return await callOpenAI(keys.openai, messages);
    }
}

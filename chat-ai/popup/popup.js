import prompt from "../prompts/rephrase.json" assert { type: "json" };
import { Storage } from "../storage.js";
import { generate } from "../llm/provider.js";

const input = document.getElementById("input");
const output = document.getElementById("output");
const tone = document.getElementById("tone");
const maxWords = document.getElementById("maxWords");

document.getElementById("openSettings").onclick = () => {
    chrome.runtime.openOptionsPage();
};

(async () => {
    const defaults = prompt.defaults;
    tone.value = defaults.tone;
    maxWords.value = defaults.maxWords;
})();

document.getElementById("gen").onclick = async () => {
    output.value = "Thinking…";

    const provider = await Storage.get("provider");
    const keys = await Storage.get("keys");
    const limit = await Storage.get("historyLimit");

    const userPrompt = prompt.template
        .replace("{{tone}}", tone.value)
        .replace("{{maxWords}}", maxWords.value)
        .replace("{{input}}", input.value);

    const messages = [
        { role: "system", content: prompt.system },
        { role: "user", content: userPrompt }
    ];

    try {
        const text = await generate(provider, keys, messages);
        output.value = text;
        await Storage.pushHistory("rephrase", { input: input.value, output: text }, limit);
    } catch {
        output.value = "Error generating response";
    }
};

chrome.runtime.onMessage.addListener(m => {
    if (m.type === "COPY_OUTPUT") {
        navigator.clipboard.writeText(output.value);
    }
});

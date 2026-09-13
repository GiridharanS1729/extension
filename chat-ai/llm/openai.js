export async function callOpenAI(key, messages) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.3
        })
    });
    if (!r.ok) throw new Error();
    const j = await r.json();
    return j.choices[0].message.content.trim();
}

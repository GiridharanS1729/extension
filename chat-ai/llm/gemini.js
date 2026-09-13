export async function callGemini(key, text) {
    const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text }] }]
            })
        }
    );
    if (!r.ok) throw new Error();
    const j = await r.json();
    return j.candidates[0].content.parts[0].text.trim();
}

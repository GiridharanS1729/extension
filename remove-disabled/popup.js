document.getElementById("apply").addEventListener("click", async () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (mode) => {
            const selector =
                mode === "checkbox"
                    ? 'input[type="checkbox"][disabled]'
                    : 'input[disabled], select[disabled], textarea[disabled], button[disabled]';

            document.querySelectorAll(selector).forEach(el => {
                el.disabled = false;
                el.removeAttribute("disabled");
            });
        },
        args: [mode]
    });
});

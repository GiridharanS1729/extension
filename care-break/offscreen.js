let currentAudio = null;
let currentType = null;

chrome.runtime.onMessage.addListener((msg) => {

    if (msg.action === "PLAY_AUDIO") {

        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }

        currentType = msg.type;

        currentAudio = new Audio(msg.file);
        currentAudio.loop = true;

        currentAudio.play().catch(console.error);
    }

    if (msg.action === "STOP_AUDIO") {
        if(msg.type && msg.type === currentType) {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio = null;
                currentType = null;
            }
        }
    }
});

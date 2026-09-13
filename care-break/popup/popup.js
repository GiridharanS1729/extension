const postureBtn = document.getElementById("postureBtn");
const waterBtn = document.getElementById("waterBtn");

const postureSection = document.getElementById("postureSection");
const waterSection = document.getElementById("waterSection");

const startPosture = document.getElementById("startPosture");
const stopPosture = document.getElementById("stopPosture");

const startWater = document.getElementById("startWater");
const stopWater = document.getElementById("stopWater");

const postureTime = document.getElementById("postureTime");
const waterTime = document.getElementById("waterTime");

postureBtn.addEventListener("click", () => {
    postureBtn.classList.add("active");
    waterBtn.classList.remove("active");

    postureSection.classList.remove("hidden");
    waterSection.classList.add("hidden");
});

waterBtn.addEventListener("click" , () => {
    waterBtn.classList.add("active");
    postureBtn.classList.remove("active");

    waterSection.classList.remove("hidden");
    postureSection.classList.add("hidden");
});

window.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(["postureInterval", "waterInterval"], (result) => {
        if(result.postureInterval) postureTime.value = result.postureInterval;
        if(result.waterInterval) waterTime.value = result.waterInterval;
    });

    chrome.runtime.sendMessage({action: "GET_STATE"}, (state) => {
        if(!state) return;
        if(state.postureRunning) startPosture.disabled = true;
        if(state.waterRunning) startWater.disabled = true;
    });

})

startPosture.addEventListener("click", () => {
    const minutes = Number(postureTime.value);

    chrome.storage.local.set({postureInterval: minutes});
    startPosture.disabled = true;

    chrome.runtime.sendMessage({
        action: "START_REMINDER",
        type: "posture",
        interval: minutes
    });
});

stopPosture.addEventListener("click", () => {
    startPosture.disabled = false;

    postureTime.value = postureTime.defaultValue;

    chrome.runtime.sendMessage({
        action: "STOP_REMINDER",
        type: "posture"
    });
});

startWater.addEventListener("click", () => {
    const minutes = Number(waterTime.value);

    chrome.storage.local.set({waterInterval: minutes});
    startWater.disabled = true;

    chrome.runtime.sendMessage({
        action: "START_REMINDER",
        type: "water",
        interval: minutes
    });
});

stopWater.addEventListener("click", () => {
    startWater.disabled = false;

    waterTime.value = waterTime.defaultValue;

    chrome.runtime.sendMessage({
        action: "STOP_REMINDER",
        type: "water"
    });
});
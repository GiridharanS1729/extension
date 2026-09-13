// Live clock, isolated from the rest of the app: it owns its own interval
// and only touches its own DOM nodes each tick, so a second-by-second tick
// never re-renders anything else on the page.

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

let settings = { timeFormat: "12", showSeconds: false };
let intervalId = null;

let timeEl;
let secondsEl;
let meridiemEl;
let dateEl;

function render() {
  if (!timeEl) return;
  const now = new Date();

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  let meridiem = "";
  const hour12 = settings.timeFormat === "12";
  if (hour12) {
    meridiem = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
  }
  const hoursStr = hour12 ? String(hours) : String(hours).padStart(2, "0");

  timeEl.textContent = `${hoursStr}:${minutes}`;
  secondsEl.textContent = settings.showSeconds ? `:${seconds}` : "";
  meridiemEl.textContent = hour12 ? meridiem : "";
  dateEl.textContent = dateFormatter.format(now);
}

export function startClock(initialSettings) {
  settings = initialSettings;
  timeEl = document.getElementById("clock-time");
  secondsEl = document.getElementById("clock-seconds");
  meridiemEl = document.getElementById("clock-meridiem");
  dateEl = document.getElementById("clock-date");

  render();
  intervalId = window.setInterval(render, 1000);

  return () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}

export function updateClockSettings(nextSettings) {
  settings = nextSettings;
  render();
}

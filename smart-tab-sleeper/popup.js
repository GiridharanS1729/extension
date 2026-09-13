const q = s => document.querySelector(s)
const enabled = q('#enabled')
const idle = q('#idle')
const refresh = q('#refresh')
const wl = q('#whitelist')
const list = q('#list')
const analytics = q('#analytics')
const toast = q('#toast')
let timer = null

function showToast() {
    toast.style.display = 'block'
    setTimeout(() => toast.style.display = 'none', 1500)
}

function loadSettings() {
    chrome.runtime.sendMessage({ type: 'getSettings' }, s => {
        if (chrome.runtime.lastError || !s) return
        enabled.checked = !!s.enabled
        idle.value = s.idleSeconds || 30
        refresh.value = s.autoRefresh || 1
        wl.value = (s.whitelist || []).join('\n')
        auto()
    })
}

function saveSettings() {
    const payload = {
        enabled: enabled.checked,
        idleSeconds: Number(idle.value) || 30,
        autoRefresh: Number(refresh.value) || 1,
        whitelist: wl.value.split('\n').map(v => v.trim()).filter(Boolean)
    }
    chrome.runtime.sendMessage({ type: 'saveSettings', payload }, res => {
        if (chrome.runtime.lastError) return
        showToast()
    })
}

function fmt(ms) {
    const s = Math.floor(ms / 1000)
    if (s < 60) return s + 's'
    return Math.floor(s / 60) + 'm ' + (s % 60) + 's'
}

function load() {
    chrome.runtime.sendMessage({ type: 'getStatus' }, d => {
        if (chrome.runtime.lastError || !d) return
        analytics.textContent = `Tabs: ${d.analytics.total}
Sleeping: ${d.analytics.sleeping}
RAM saved: ${d.analytics.ramSaved} MB`
        list.innerHTML = ''
        d.tabs.forEach(t => {
            const li = document.createElement('li')
            const state = t.discarded ? 'Slept' : 'Idle'
            const time = t.discarded ? t.sleptMs : t.idleMs
            const white = t.whitelisted ? 'Whitelisted' : ''
            li.innerHTML =
                `<div>${t.title}</div>
<div class="small">${white}
${state}: ${fmt(time)} • RAM ${t.ramMB} MB</div>
<div class="actions">
${!t.whitelisted ? '<button data-sleep="' + t.id + '">Sleep</button>' : ''}
<button data-open="${t.id}">Open</button>
</div>`
            list.appendChild(li)
        })
    })
}

list.onclick = e => {
    if (e.target.dataset.sleep) {
        chrome.runtime.sendMessage({ type: 'sleep', id: Number(e.target.dataset.sleep) })
    }
    if (e.target.dataset.open) {
        chrome.runtime.sendMessage({ type: 'open', id: Number(e.target.dataset.open) })
    }
}

function auto() {
    if (timer) clearInterval(timer)
    const sec = Number(refresh.value) || 1
    timer = setInterval(load, sec * 1000)
}

enabled.onchange = saveSettings
q('#save').onclick = () => { saveSettings(); auto() }
q('#manual').onclick = load
refresh.onchange = auto

loadSettings()
load()

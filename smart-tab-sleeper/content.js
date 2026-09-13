let t = null
const k = () => location.href

const save = () => {
    chrome.storage.local.set({ ['s:' + k()]: { x: scrollX, y: scrollY } })
}

const restore = () => {
    chrome.storage.local.get('s:' + k(), d => {
        const v = d['s:' + k()]
        if (v) scrollTo(v.x, v.y)
    })
}

addEventListener('scroll', () => {
    clearTimeout(t)
    t = setTimeout(save, 300)
}, { passive: true })

addEventListener('beforeunload', save)
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore)
else restore()

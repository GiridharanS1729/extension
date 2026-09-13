const SKEY = 'settings'
const AKEY = 'activity'
const SLKEY = 'slept'

const DEFAULT = {
    enabled: true,
    idleSeconds: 30,
    autoRefresh: 1,
    whitelist: []
}

const now = () => Date.now()

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(SKEY, d => {
        if (!d[SKEY]) chrome.storage.sync.set({ [SKEY]: DEFAULT })
    })
    chrome.alarms.create('tick', { periodInMinutes: 0.05 })
})

chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create('tick', { periodInMinutes: 0.05 })
})

function touch(id) {
    chrome.storage.local.get(AKEY, d => {
        const a = d[AKEY] || {}
        a[id] = now()
        chrome.storage.local.set({ [AKEY]: a })
    })
}

chrome.tabs.onActivated.addListener(i => touch(i.tabId))
chrome.tabs.onUpdated.addListener((id, info) => info.status === 'complete' && touch(id))

chrome.alarms.onAlarm.addListener(a => {
    if (a.name !== 'tick') return
    chrome.storage.sync.get(SKEY, sd => {
        const set = sd[SKEY] || DEFAULT
        if (!set.enabled) return
        chrome.tabs.query({}, tabs => {
            chrome.storage.local.get(AKEY, d => {
                const act = d[AKEY] || {}
                const t = now()
                tabs.forEach(tb => {
                    if (tb.active || tb.pinned || tb.audible || tb.discarded) return
                    let host = ''
                    try { host = new URL(tb.url || '').hostname } catch (e) { }
                    if (set.whitelist.some(w => w && host.includes(w))) return
                    if (t - (act[tb.id] || t) >= set.idleSeconds * 1000) {
                        chrome.storage.local.get(SLKEY, sld => {
                            const sl = sld[SLKEY] || {}
                            sl[tb.id] = t
                            chrome.storage.local.set({ [SLKEY]: sl }, () => chrome.tabs.discard(tb.id))
                        })
                    }
                })
            })
        })
    })
})

chrome.runtime.onMessage.addListener((m, s, r) => {
    if (m.type === 'getSettings') {
        chrome.storage.sync.get(SKEY, d => r(d[SKEY] || DEFAULT))
        return true
    }

    if (m.type === 'saveSettings') {
        chrome.storage.sync.set({ [SKEY]: m.payload }, () => r({ ok: true }))
        return true
    }

    if (m.type === 'getStatus') {
        chrome.storage.sync.get(SKEY, sd => {
            const set = sd[SKEY] || DEFAULT
            chrome.tabs.query({}, tabs => {
                chrome.storage.local.get([AKEY, SLKEY], d => {
                    const act = d[AKEY] || {}
                    const slp = d[SLKEY] || {}
                    const t = now()
                    let sleeping = 0
                    let ramSaved = 0
                    const list = tabs.map(tb => {
                        let host = ''
                        try { host = new URL(tb.url || '').hostname } catch (e) { }
                        const white = set.whitelist.some(w => w && host.includes(w))
                        let idle = 0
                        let slept = 0
                        if (tb.discarded) {
                            sleeping++
                            slept = t - (slp[tb.id] || t)
                            ramSaved += estimateRam()
                        } else {
                            idle = t - (act[tb.id] || t)
                        }
                        return {
                            id: tb.id,
                            title: tb.title || tb.url || 'Tab',
                            url: tb.url || '',
                            discarded: tb.discarded,
                            idleMs: idle,
                            sleptMs: slept,
                            ramMB: estimateRam(),
                            whitelisted: white
                        }
                    }).sort((a, b) => {
                        const ax = a.discarded ? a.sleptMs : a.idleMs
                        const bx = b.discarded ? b.sleptMs : b.idleMs
                        return bx - ax
                    })
                    r({
                        tabs: list,
                        analytics: {
                            total: tabs.length,
                            sleeping,
                            ramSaved
                        }
                    })
                })
            })
        })
        return true
    }

    if (m.type === 'sleep') {
        chrome.storage.local.get(SLKEY, d => {
            const sl = d[SLKEY] || {}
            sl[m.id] = now()
            chrome.storage.local.set({ [SLKEY]: sl }, () => chrome.tabs.discard(m.id))
        })
    }

    if (m.type === 'open') {
        chrome.tabs.update(m.id, { active: true })
    }
})

function estimateRam() {
    return 120
}

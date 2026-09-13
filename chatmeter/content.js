/* ChatMeter - content.js
 * Injected into claude.ai, chatgpt.com, chat.openai.com
 * Vanilla JS only. No network calls, no external libraries.
 *
 * ------------------------------------------------------------------
 * HEURISTICS / ASSUMPTIONS (all approximate, NOT verified/exact):
 *
 * 1) TOKEN ESTIMATE:
 *    Default is the widely-cited rule of thumb of ~4 characters per
 *    token for English text (DEFAULT_SETTINGS.charsPerToken below).
 *    This approximates real tokenizer behavior (e.g. BPE); it does
 *    not exactly match any specific model's tokenizer. Editable live
 *    from the widget's Settings panel.
 *
 * 2) INPUT / OUTPUT SPLIT:
 *    Tokens are additionally split into "input" (your messages) and
 *    "output" (the assistant's replies) by scanning role-specific DOM
 *    nodes separately, then summed for the total. If a site's markup
 *    doesn't let us tell roles apart (fallback selectors only), the
 *    text is counted as "unclassified" and still included in the
 *    total, but not attributed to input or output.
 *
 * 3) CONTEXT LIMIT REMAINING:
 *    Compares total estimated tokens against a per-site constant
 *    approximating that provider's context window
 *    (DEFAULT_SETTINGS.claudeContextLimit / chatgptContextLimit).
 *    Editable from Settings. May not reflect the exact model/limit in
 *    use for a given conversation.
 *
 * 4) WATER USAGE ESTIMATE:
 *    Total tokens x a "mL of water per token" constant
 *    (DEFAULT_SETTINGS.waterMlPerToken). Rough, editable placeholder
 *    loosely inspired by public discussion of AI water footprint
 *    estimates - NOT a verified or authoritative figure.
 *
 * 5) COST ESTIMATE:
 *    Input tokens x cost-per-1K-input, plus output tokens x
 *    cost-per-1K-output (DEFAULT_SETTINGS.costPerInputPer1k /
 *    costPerOutputPer1k). These are illustrative placeholder rates,
 *    NOT real-time pricing for any specific model or plan - edit them
 *    in Settings to match whatever you want to model.
 *
 * 6) WHY TOKEN COUNTS CAN LOOK LOW:
 *    Both claude.ai and chatgpt.com "virtualize" long chats - only
 *    messages currently scrolled into view (plus a little padding)
 *    exist in the DOM at any moment. A naive scan only sees those
 *    rendered nodes. forceRenderAllMessages() below auto-scrolls the
 *    message container to the top (and back) before scanning, which
 *    causes most chat UIs to lazily mount earlier messages. This is a
 *    best-effort mitigation, not a guarantee every message is
 *    captured on extremely long chats or unusual scroll containers.
 * ------------------------------------------------------------------
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------
  // DEFAULT / EDITABLE SETTINGS
  // All of these can also be changed at runtime from the widget's
  // Settings panel (gear icon); changes persist via
  // chrome.storage.local so they survive reloads.
  // ---------------------------------------------------------------

  const DEFAULT_SETTINGS = {
    charsPerToken: 4, // ~4 characters per token heuristic
    claudeContextLimit: 200000, // approx. tokens, varies by Claude model
    chatgptContextLimit: 128000, // approx. tokens, varies by ChatGPT model
    waterMlPerToken: 0.05, // rough, illustrative mL of water per token
    costPerInputPer1k: 0.003, // rough, illustrative $ per 1K input tokens
    costPerOutputPer1k: 0.015, // rough, illustrative $ per 1K output tokens
  };

  const SETTINGS_STORAGE_KEY = 'chatmeter_settings';
  const VISIBILITY_STORAGE_KEY = 'chatmeter_visible';
  const POSITION_STORAGE_KEY = 'chatmeter_position';

  let settings = Object.assign({}, DEFAULT_SETTINGS);

  // ---------------------------------------------------------------
  // SITE DETECTION
  // ---------------------------------------------------------------

  const HOST = window.location.hostname;
  const IS_CLAUDE = HOST.includes('claude.ai');
  const IS_CHATGPT = HOST.includes('chatgpt.com') || HOST.includes('chat.openai.com');
  const SITE_LABEL = IS_CLAUDE ? 'Claude' : 'ChatGPT';

  function getContextLimit() {
    return IS_CLAUDE ? settings.claudeContextLimit : settings.chatgptContextLimit;
  }

  // ---------------------------------------------------------------
  // SITE-SPECIFIC MESSAGE SELECTORS
  // NOTE: These selectors are based on current (as of writing) page
  // markup for each site and may need updating if either site
  // changes its DOM structure / class names.
  // ---------------------------------------------------------------

  const CLAUDE_USER_SELECTORS = ['[data-testid="user-message"]'];
  const CLAUDE_ASSISTANT_SELECTORS = [
    '[data-testid="assistant-message"]',
    'div.font-claude-message',
  ];
  const CLAUDE_FALLBACK_SELECTORS = ['[data-test-render-count]'];

  const CHATGPT_USER_SELECTORS = ['[data-message-author-role="user"]'];
  const CHATGPT_ASSISTANT_SELECTORS = ['[data-message-author-role="assistant"]'];
  const CHATGPT_FALLBACK_SELECTORS = [];

  function getActiveMessageSelectors() {
    // Used only to locate the scrollable chat container - combine
    // every selector we know about for the active site.
    if (IS_CLAUDE) {
      return [...CLAUDE_USER_SELECTORS, ...CLAUDE_ASSISTANT_SELECTORS, ...CLAUDE_FALLBACK_SELECTORS];
    }
    return [...CHATGPT_USER_SELECTORS, ...CHATGPT_ASSISTANT_SELECTORS];
  }

  function collectTextFromSelectors(selectors) {
    const seen = new Set();
    let combined = '';
    selectors.forEach((sel) => {
      let nodes;
      try {
        nodes = document.querySelectorAll(sel);
      } catch (e) {
        nodes = [];
      }
      nodes.forEach((node) => {
        if (seen.has(node)) return;
        seen.add(node);
        const text = node.innerText || node.textContent || '';
        if (text && text.trim().length > 0) {
          combined += text.trim() + '\n';
        }
      });
    });
    return combined;
  }

  // Scans the current chat and splits text into input (user),
  // output (assistant), and unclassified (fallback-only match, when
  // role-specific selectors found nothing).
  function scanRoleBasedText() {
    let inputText = '';
    let outputText = '';
    let unclassifiedText = '';

    if (IS_CLAUDE) {
      inputText = collectTextFromSelectors(CLAUDE_USER_SELECTORS);
      outputText = collectTextFromSelectors(CLAUDE_ASSISTANT_SELECTORS);
      if (!inputText && !outputText) {
        unclassifiedText = collectTextFromSelectors(CLAUDE_FALLBACK_SELECTORS);
      }
    } else if (IS_CHATGPT) {
      inputText = collectTextFromSelectors(CHATGPT_USER_SELECTORS);
      outputText = collectTextFromSelectors(CHATGPT_ASSISTANT_SELECTORS);
      if (!inputText && !outputText) {
        unclassifiedText = collectTextFromSelectors(CHATGPT_FALLBACK_SELECTORS);
      }
    }

    return { inputText, outputText, unclassifiedText };
  }

  // ---------------------------------------------------------------
  // ESTIMATION LOGIC
  // ---------------------------------------------------------------

  function estimateTokens(text) {
    if (!text) return 0;
    return Math.max(0, Math.round(text.length / settings.charsPerToken));
  }

  function estimateWaterMl(tokenCount) {
    return tokenCount * settings.waterMlPerToken;
  }

  function estimateCostUsd(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1000) * settings.costPerInputPer1k;
    const outputCost = (outputTokens / 1000) * settings.costPerOutputPer1k;
    return inputCost + outputCost;
  }

  function formatNumber(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  function formatMl(ml) {
    if (ml >= 1000) return (ml / 1000).toFixed(2) + ' L';
    return ml.toFixed(1) + ' mL';
  }

  function formatUsd(usd) {
    if (usd < 0.01 && usd > 0) return '<$0.01';
    return '$' + usd.toFixed(2);
  }

  function formatTime(date) {
    try {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  // ---------------------------------------------------------------
  // SCROLL-TO-LOAD FIX FOR VIRTUALIZED CHATS
  // ---------------------------------------------------------------

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function findScrollableMessageContainer() {
    const selectors = getActiveMessageSelectors();
    for (const sel of selectors) {
      let node;
      try {
        node = document.querySelector(sel);
      } catch (e) {
        node = null;
      }
      if (!node) continue;
      let parent = node.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        const canScroll = style.overflowY === 'auto' || style.overflowY === 'scroll';
        if (canScroll && parent.scrollHeight > parent.clientHeight + 4) {
          return parent;
        }
        parent = parent.parentElement;
      }
    }
    return document.querySelector('main');
  }

  const MAX_SCROLL_ITERATIONS = 40;
  const SCROLL_SETTLE_DELAY_MS = 250;

  async function forceRenderAllMessages() {
    const container = findScrollableMessageContainer();
    if (!container) return;

    const originalScrollTop = container.scrollTop;
    let lastScrollHeight = -1;

    for (let i = 0; i < MAX_SCROLL_ITERATIONS; i++) {
      container.scrollTop = 0;
      await sleep(SCROLL_SETTLE_DELAY_MS);
      if (container.scrollHeight === lastScrollHeight) break;
      lastScrollHeight = container.scrollHeight;
    }

    container.scrollTop = container.scrollHeight;
    await sleep(150);
    container.scrollTop = originalScrollTop || container.scrollTop;
  }

  // ---------------------------------------------------------------
  // WIDGET STATE
  // ---------------------------------------------------------------

  let stats = null; // last computed stats object, or null
  let currentChatKey = getChatKey();

  function getChatKey() {
    return window.location.pathname;
  }

  function blankStats() {
    return {
      inputTokens: 0,
      outputTokens: 0,
      unclassifiedTokens: 0,
      totalTokens: 0,
      waterMl: 0,
      costUsd: 0,
      chatCount: null,
      scannedAt: null,
    };
  }

  function resetStats() {
    stats = null;
    renderStats(null);
  }

  // ---------------------------------------------------------------
  // WIDGET DOM CONSTRUCTION
  // ---------------------------------------------------------------

  const root = document.createElement('div');
  root.id = 'chatmeter-root';

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'chatmeter-toggle';
  toggleBtn.type = 'button';
  toggleBtn.title = 'Show/Hide ChatMeter (drag to move)';
  toggleBtn.textContent = 'CM';

  const panel = document.createElement('div');
  panel.id = 'chatmeter-panel';
  panel.innerHTML = `
    <div id="chatmeter-header">
      <span id="chatmeter-title">ChatMeter</span>
      <span id="chatmeter-site">${SITE_LABEL}</span>
      <button id="chatmeter-settings-btn" type="button" title="Settings">&#9881;</button>
    </div>

    <div id="chatmeter-settings-panel" class="chatmeter-hidden">
      <div class="chatmeter-setting-row">
        <label for="cm-set-chars">Chars / token</label>
        <input type="number" id="cm-set-chars" min="1" step="0.1" />
      </div>
      <div class="chatmeter-setting-row">
        <label for="cm-set-claude-limit">Claude context limit</label>
        <input type="number" id="cm-set-claude-limit" min="1000" step="1000" />
      </div>
      <div class="chatmeter-setting-row">
        <label for="cm-set-chatgpt-limit">ChatGPT context limit</label>
        <input type="number" id="cm-set-chatgpt-limit" min="1000" step="1000" />
      </div>
      <div class="chatmeter-setting-row">
        <label for="cm-set-water">Water mL / token</label>
        <input type="number" id="cm-set-water" min="0" step="0.001" />
      </div>
      <div class="chatmeter-setting-row">
        <label for="cm-set-cost-in">$ / 1K input tok</label>
        <input type="number" id="cm-set-cost-in" min="0" step="0.001" />
      </div>
      <div class="chatmeter-setting-row">
        <label for="cm-set-cost-out">$ / 1K output tok</label>
        <input type="number" id="cm-set-cost-out" min="0" step="0.001" />
      </div>
      <div id="chatmeter-settings-actions">
        <button id="chatmeter-settings-save" type="button">Save</button>
        <button id="chatmeter-settings-reset" type="button">Reset defaults</button>
      </div>
      <div id="chatmeter-settings-note">
        All figures above are rough, editable placeholders - not
        verified pricing/tokenizer data.
      </div>
    </div>

    <div id="chatmeter-buttons">
      <button id="chatmeter-analyse" type="button">Analyse This Chat</button>
      <button id="chatmeter-analyse-all" type="button">Analyse All Chats</button>
    </div>
    <div id="chatmeter-progress"></div>

    <div id="chatmeter-stats">
      <div class="chatmeter-row">
        <span class="chatmeter-label">Input tokens</span>
        <span class="chatmeter-value" id="chatmeter-input">-</span>
      </div>
      <div class="chatmeter-row">
        <span class="chatmeter-label">Output tokens</span>
        <span class="chatmeter-value" id="chatmeter-output">-</span>
      </div>
      <div class="chatmeter-row chatmeter-row-strong">
        <span class="chatmeter-label">Total tokens</span>
        <span class="chatmeter-value" id="chatmeter-total">-</span>
      </div>
      <div class="chatmeter-row" id="chatmeter-unclassified-row" style="display:none;">
        <span class="chatmeter-label">Unclassified</span>
        <span class="chatmeter-value" id="chatmeter-unclassified">-</span>
      </div>

      <div id="chatmeter-bar-wrap">
        <div id="chatmeter-bar-track">
          <div id="chatmeter-bar-fill"></div>
        </div>
        <div id="chatmeter-bar-label">-</div>
      </div>

      <div class="chatmeter-row">
        <span class="chatmeter-label">Water usage (rough est.)</span>
        <span class="chatmeter-value" id="chatmeter-water">-</span>
      </div>
      <div class="chatmeter-row">
        <span class="chatmeter-label">Est. cost (rough)</span>
        <span class="chatmeter-value" id="chatmeter-cost">-</span>
      </div>
      <div class="chatmeter-row" id="chatmeter-chatcount-row" style="display:none;">
        <span class="chatmeter-label">Chats scanned</span>
        <span class="chatmeter-value" id="chatmeter-chatcount">-</span>
      </div>
      <div class="chatmeter-row" id="chatmeter-time-row" style="display:none;">
        <span class="chatmeter-label">Last scanned</span>
        <span class="chatmeter-value" id="chatmeter-time">-</span>
      </div>

      <button id="chatmeter-copy" type="button">Copy Report</button>

      <div id="chatmeter-note">
        Estimates only - not verified/exact figures. ~<span id="chatmeter-note-chars">4</span>
        chars/token; water and cost figures are illustrative. Long
        chats are auto-scrolled first to reduce undercounting from
        lazy-loaded messages.
      </div>
    </div>
  `;

  root.appendChild(toggleBtn);
  root.appendChild(panel);
  document.documentElement.appendChild(root);

  // ---------------------------------------------------------------
  // DOM REFS
  // ---------------------------------------------------------------

  const settingsBtn = panel.querySelector('#chatmeter-settings-btn');
  const settingsPanel = panel.querySelector('#chatmeter-settings-panel');
  const setCharsInput = panel.querySelector('#cm-set-chars');
  const setClaudeLimitInput = panel.querySelector('#cm-set-claude-limit');
  const setChatgptLimitInput = panel.querySelector('#cm-set-chatgpt-limit');
  const setWaterInput = panel.querySelector('#cm-set-water');
  const setCostInInput = panel.querySelector('#cm-set-cost-in');
  const setCostOutInput = panel.querySelector('#cm-set-cost-out');
  const settingsSaveBtn = panel.querySelector('#chatmeter-settings-save');
  const settingsResetBtn = panel.querySelector('#chatmeter-settings-reset');

  const analyseBtn = panel.querySelector('#chatmeter-analyse');
  const analyseAllBtn = panel.querySelector('#chatmeter-analyse-all');
  const progressEl = panel.querySelector('#chatmeter-progress');

  const inputEl = panel.querySelector('#chatmeter-input');
  const outputEl = panel.querySelector('#chatmeter-output');
  const totalEl = panel.querySelector('#chatmeter-total');
  const unclassifiedRow = panel.querySelector('#chatmeter-unclassified-row');
  const unclassifiedEl = panel.querySelector('#chatmeter-unclassified');
  const waterEl = panel.querySelector('#chatmeter-water');
  const costEl = panel.querySelector('#chatmeter-cost');
  const chatCountRow = panel.querySelector('#chatmeter-chatcount-row');
  const chatCountEl = panel.querySelector('#chatmeter-chatcount');
  const timeRow = panel.querySelector('#chatmeter-time-row');
  const timeEl = panel.querySelector('#chatmeter-time');
  const barFill = panel.querySelector('#chatmeter-bar-fill');
  const barLabel = panel.querySelector('#chatmeter-bar-label');
  const copyBtn = panel.querySelector('#chatmeter-copy');
  const noteCharsEl = panel.querySelector('#chatmeter-note-chars');

  // ---------------------------------------------------------------
  // SETTINGS: LOAD / SAVE / APPLY
  // ---------------------------------------------------------------

  function populateSettingsForm() {
    setCharsInput.value = settings.charsPerToken;
    setClaudeLimitInput.value = settings.claudeContextLimit;
    setChatgptLimitInput.value = settings.chatgptContextLimit;
    setWaterInput.value = settings.waterMlPerToken;
    setCostInInput.value = settings.costPerInputPer1k;
    setCostOutInput.value = settings.costPerOutputPer1k;
    noteCharsEl.textContent = settings.charsPerToken;
  }

  function loadSettings() {
    try {
      chrome.storage.local.get([SETTINGS_STORAGE_KEY], (result) => {
        const saved = result[SETTINGS_STORAGE_KEY];
        if (saved && typeof saved === 'object') {
          settings = Object.assign({}, DEFAULT_SETTINGS, saved);
        }
        populateSettingsForm();
      });
    } catch (e) {
      populateSettingsForm();
    }
  }

  function saveSettingsFromForm() {
    const next = {
      charsPerToken: parseFloat(setCharsInput.value) || DEFAULT_SETTINGS.charsPerToken,
      claudeContextLimit: parseInt(setClaudeLimitInput.value, 10) || DEFAULT_SETTINGS.claudeContextLimit,
      chatgptContextLimit: parseInt(setChatgptLimitInput.value, 10) || DEFAULT_SETTINGS.chatgptContextLimit,
      waterMlPerToken: parseFloat(setWaterInput.value) || 0,
      costPerInputPer1k: parseFloat(setCostInInput.value) || 0,
      costPerOutputPer1k: parseFloat(setCostOutInput.value) || 0,
    };
    settings = next;
    noteCharsEl.textContent = settings.charsPerToken;
    try {
      chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
    } catch (e) {
      // ignore storage failures
    }
    flashProgress('Settings saved.');
    // Re-render existing stats (if any) under the new settings so
    // numbers on screen stay consistent without re-scanning the DOM.
    if (stats) {
      stats.waterMl = estimateWaterMl(stats.totalTokens);
      stats.costUsd = estimateCostUsd(stats.inputTokens, stats.outputTokens);
      renderStats(stats);
    }
  }

  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('chatmeter-hidden');
  });

  settingsSaveBtn.addEventListener('click', saveSettingsFromForm);

  settingsResetBtn.addEventListener('click', () => {
    settings = Object.assign({}, DEFAULT_SETTINGS);
    populateSettingsForm();
    try {
      chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
    } catch (e) {
      // ignore
    }
    flashProgress('Reset to defaults.');
  });

  loadSettings();

  function flashProgress(msg) {
    progressEl.textContent = msg;
    setTimeout(() => {
      if (progressEl.textContent === msg) progressEl.textContent = '';
    }, 2000);
  }

  // ---------------------------------------------------------------
  // RENDER STATS
  // ---------------------------------------------------------------

  function renderStats(computed) {
    if (!computed) {
      inputEl.textContent = '-';
      outputEl.textContent = '-';
      totalEl.textContent = '-';
      unclassifiedRow.style.display = 'none';
      waterEl.textContent = '-';
      costEl.textContent = '-';
      chatCountRow.style.display = 'none';
      timeRow.style.display = 'none';
      barFill.style.width = '0%';
      barFill.classList.remove('chatmeter-bar-warn', 'chatmeter-bar-danger');
      barLabel.textContent = '-';
      return;
    }

    inputEl.textContent = formatNumber(computed.inputTokens);
    outputEl.textContent = formatNumber(computed.outputTokens);
    totalEl.textContent = formatNumber(computed.totalTokens);

    if (computed.unclassifiedTokens > 0) {
      unclassifiedRow.style.display = '';
      unclassifiedEl.textContent = formatNumber(computed.unclassifiedTokens);
    } else {
      unclassifiedRow.style.display = 'none';
    }

    waterEl.textContent = formatMl(computed.waterMl);
    costEl.textContent = formatUsd(computed.costUsd);

    if (computed.chatCount !== null && computed.chatCount !== undefined) {
      chatCountRow.style.display = '';
      chatCountEl.textContent = formatNumber(computed.chatCount);
      // A single context-window bar isn't meaningful across multiple
      // separate chats, so show combined usage against N x the
      // per-chat limit as a rough aggregate indicator instead.
      const aggregateLimit = getContextLimit() * Math.max(1, computed.chatCount);
      updateBar(computed.totalTokens, aggregateLimit, true);
    } else {
      chatCountRow.style.display = 'none';
      updateBar(computed.totalTokens, getContextLimit(), false);
    }

    if (computed.scannedAt) {
      timeRow.style.display = '';
      timeEl.textContent = formatTime(computed.scannedAt);
    } else {
      timeRow.style.display = 'none';
    }
  }

  function updateBar(tokens, limit, isAggregate) {
    const pct = limit > 0 ? Math.min(100, (tokens / limit) * 100) : 0;
    barFill.style.width = pct.toFixed(1) + '%';
    barFill.classList.remove('chatmeter-bar-warn', 'chatmeter-bar-danger');
    if (pct >= 90) barFill.classList.add('chatmeter-bar-danger');
    else if (pct >= 70) barFill.classList.add('chatmeter-bar-warn');

    const remaining = Math.max(0, limit - tokens);
    barLabel.textContent = isAggregate
      ? `${pct.toFixed(0)}% of combined est. capacity (${formatNumber(remaining)} tok. headroom left)`
      : `${pct.toFixed(0)}% of ${formatNumber(limit)} tok. limit (${formatNumber(remaining)} left)`;
  }

  // ---------------------------------------------------------------
  // SINGLE-CHAT ANALYSIS
  // ---------------------------------------------------------------

  function setButtonsDisabled(disabled) {
    analyseBtn.disabled = disabled;
    analyseAllBtn.disabled = disabled;
  }

  function computeStatsFromCurrentDom() {
    const { inputText, outputText, unclassifiedText } = scanRoleBasedText();
    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);
    const unclassifiedTokens = estimateTokens(unclassifiedText);
    const totalTokens = inputTokens + outputTokens + unclassifiedTokens;
    return { inputTokens, outputTokens, unclassifiedTokens, totalTokens };
  }

  async function runAnalysis() {
    setButtonsDisabled(true);
    const originalLabel = analyseBtn.textContent;
    analyseBtn.textContent = 'Scanning...';
    progressEl.textContent = 'Scrolling to load full chat...';

    try {
      await forceRenderAllMessages();
      const counts = computeStatsFromCurrentDom();
      const waterMl = estimateWaterMl(counts.totalTokens);
      const costUsd = estimateCostUsd(counts.inputTokens, counts.outputTokens);

      stats = Object.assign(blankStats(), counts, {
        waterMl,
        costUsd,
        chatCount: null,
        scannedAt: new Date(),
      });
      renderStats(stats);
    } finally {
      progressEl.textContent = '';
      analyseBtn.textContent = originalLabel;
      setButtonsDisabled(false);
    }
  }

  analyseBtn.addEventListener('click', runAnalysis);

  // ---------------------------------------------------------------
  // ANALYSE ALL CHATS
  // Walks each conversation link in the sidebar, briefly navigates
  // to it (SPA client-side routing via a real click, no network
  // requests made by this extension itself), scans and totals its
  // tokens/water/cost, then returns to the chat the user started on.
  // ---------------------------------------------------------------

  const CLAUDE_CHAT_LINK_SELECTOR = 'a[href^="/chat/"]';
  const CHATGPT_CHAT_LINK_SELECTOR = 'a[href*="/c/"]';

  function getChatLinkSelector() {
    return IS_CLAUDE ? CLAUDE_CHAT_LINK_SELECTOR : CHATGPT_CHAT_LINK_SELECTOR;
  }

  function getAllChatHrefs() {
    const selector = getChatLinkSelector();
    const anchors = Array.from(document.querySelectorAll(selector));
    const hrefs = new Set();
    anchors.forEach((a) => {
      try {
        const url = new URL(a.getAttribute('href'), window.location.origin);
        if (url.origin === window.location.origin) hrefs.add(url.pathname);
      } catch (e) {
        // ignore malformed hrefs
      }
    });
    return Array.from(hrefs);
  }

  function findLinkForPath(path) {
    const selector = getChatLinkSelector();
    const anchors = Array.from(document.querySelectorAll(selector));
    return anchors.find((a) => {
      try {
        const url = new URL(a.getAttribute('href'), window.location.origin);
        return url.pathname === path;
      } catch (e) {
        return false;
      }
    });
  }

  async function navigateToPath(path, timeoutMs) {
    if (window.location.pathname === path) return true;
    const link = findLinkForPath(path);
    if (!link) return false;

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.location.pathname === path) {
        await sleep(500);
        return true;
      }
      await sleep(100);
    }
    return false;
  }

  async function runAnalyseAllChats() {
    setButtonsDisabled(true);
    const originalLabel = analyseAllBtn.textContent;
    const startingPath = window.location.pathname;

    try {
      const hrefs = getAllChatHrefs();
      if (hrefs.length === 0) {
        flashProgress('No chat list found on this page.');
        return;
      }

      if (!hrefs.includes(startingPath) && /\/(chat|c)\//.test(startingPath)) {
        hrefs.push(startingPath);
      }

      let totalInput = 0;
      let totalOutput = 0;
      let totalUnclassified = 0;
      let scannedCount = 0;

      for (let i = 0; i < hrefs.length; i++) {
        const path = hrefs[i];
        analyseAllBtn.textContent = `Scanning ${i + 1}/${hrefs.length}...`;
        progressEl.textContent = `Chat ${i + 1} of ${hrefs.length}`;

        const arrived = await navigateToPath(path, 6000);
        if (!arrived && window.location.pathname !== path) continue;

        await forceRenderAllMessages();
        const counts = computeStatsFromCurrentDom();
        totalInput += counts.inputTokens;
        totalOutput += counts.outputTokens;
        totalUnclassified += counts.unclassifiedTokens;
        scannedCount += 1;
      }

      if (window.location.pathname !== startingPath) {
        await navigateToPath(startingPath, 6000);
      }

      const totalTokens = totalInput + totalOutput + totalUnclassified;
      const waterMl = estimateWaterMl(totalTokens);
      const costUsd = estimateCostUsd(totalInput, totalOutput);

      stats = {
        inputTokens: totalInput,
        outputTokens: totalOutput,
        unclassifiedTokens: totalUnclassified,
        totalTokens,
        waterMl,
        costUsd,
        chatCount: scannedCount,
        scannedAt: new Date(),
      };
      renderStats(stats);
    } finally {
      progressEl.textContent = '';
      analyseAllBtn.textContent = originalLabel;
      setButtonsDisabled(false);
    }
  }

  analyseAllBtn.addEventListener('click', runAnalyseAllChats);

  // ---------------------------------------------------------------
  // COPY REPORT
  // ---------------------------------------------------------------

  function buildReportText() {
    if (!stats) return 'ChatMeter: no analysis has been run yet.';
    const lines = [
      `ChatMeter report - ${SITE_LABEL}`,
      stats.chatCount !== null ? `Chats scanned: ${stats.chatCount}` : `Chat: ${window.location.pathname}`,
      `Input tokens: ${formatNumber(stats.inputTokens)}`,
      `Output tokens: ${formatNumber(stats.outputTokens)}`,
      stats.unclassifiedTokens > 0 ? `Unclassified tokens: ${formatNumber(stats.unclassifiedTokens)}` : null,
      `Total tokens: ${formatNumber(stats.totalTokens)}`,
      `Water usage (rough est.): ${formatMl(stats.waterMl)}`,
      `Cost (rough est.): ${formatUsd(stats.costUsd)}`,
      stats.scannedAt ? `Scanned at: ${formatTime(stats.scannedAt)}` : null,
      'All figures are rough estimates, not verified measurements.',
    ].filter(Boolean);
    return lines.join('\n');
  }

  async function copyReport() {
    const text = buildReportText();
    try {
      await navigator.clipboard.writeText(text);
      flashProgress('Report copied to clipboard.');
    } catch (e) {
      // Fallback for pages where the async Clipboard API is blocked.
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        flashProgress('Report copied to clipboard.');
      } catch (e2) {
        flashProgress('Could not copy - see console.');
        console.warn('ChatMeter: clipboard copy failed', e2);
      }
    }
  }

  copyBtn.addEventListener('click', copyReport);

  // ---------------------------------------------------------------
  // SHOW/HIDE TOGGLE + DRAG (both persisted via chrome.storage.local)
  // ---------------------------------------------------------------

  function setPanelVisibility(visible) {
    if (visible) panel.classList.add('chatmeter-visible');
    else panel.classList.remove('chatmeter-visible');
  }

  function persistVisibility(visible) {
    try {
      chrome.storage.local.set({ [VISIBILITY_STORAGE_KEY]: visible });
    } catch (e) {
      // ignore
    }
  }

  try {
    chrome.storage.local.get([VISIBILITY_STORAGE_KEY, POSITION_STORAGE_KEY], (result) => {
      setPanelVisibility(!!result[VISIBILITY_STORAGE_KEY]);
      const pos = result[POSITION_STORAGE_KEY];
      if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
        root.style.left = pos.left + 'px';
        root.style.top = pos.top + 'px';
        root.style.right = 'auto';
        root.style.bottom = 'auto';
      }
    });
  } catch (e) {
    setPanelVisibility(false);
  }

  // Dragging the round toggle button moves the whole widget; a plain
  // click (no meaningful movement) toggles the panel instead.
  let isDragging = false;
  let dragMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let originLeft = 0;
  let originTop = 0;

  toggleBtn.addEventListener('pointerdown', (e) => {
    isDragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = root.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    try {
      toggleBtn.setPointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }
  });

  toggleBtn.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragMoved = true;
      let newLeft = originLeft + dx;
      let newTop = originTop + dy;
      newLeft = Math.max(4, Math.min(window.innerWidth - 48, newLeft));
      newTop = Math.max(4, Math.min(window.innerHeight - 48, newTop));
      root.style.left = newLeft + 'px';
      root.style.top = newTop + 'px';
      root.style.right = 'auto';
      root.style.bottom = 'auto';
    }
  });

  toggleBtn.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    try {
      toggleBtn.releasePointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }

    if (dragMoved) {
      const rect = root.getBoundingClientRect();
      try {
        chrome.storage.local.set({ [POSITION_STORAGE_KEY]: { left: rect.left, top: rect.top } });
      } catch (err) {
        // ignore
      }
    } else {
      const next = !panel.classList.contains('chatmeter-visible');
      setPanelVisibility(next);
      persistVisibility(next);
    }
  });

  // ---------------------------------------------------------------
  // NEW-CHAT / CHAT-SWITCH DETECTION
  // ---------------------------------------------------------------
  // Strategy:
  //  1) Watch for URL (pathname) changes via polling + patched
  //     history methods (SPA navigations do not always fire
  //     popstate).
  //  2) Watch for large-scale DOM resets in the main chat container
  //     via MutationObserver, as an additional signal in case the
  //     URL does not change (e.g. clicking "New chat" before a route
  //     change completes).

  function checkForChatSwitch() {
    const key = getChatKey();
    if (key !== currentChatKey) {
      currentChatKey = key;
      resetStats();
    }
  }

  (function patchHistory() {
    const rawPushState = history.pushState;
    const rawReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = rawPushState.apply(this, args);
      window.dispatchEvent(new Event('chatmeter:locationchange'));
      return result;
    };

    history.replaceState = function (...args) {
      const result = rawReplaceState.apply(this, args);
      window.dispatchEvent(new Event('chatmeter:locationchange'));
      return result;
    };

    window.addEventListener('popstate', () => {
      window.dispatchEvent(new Event('chatmeter:locationchange'));
    });
  })();

  window.addEventListener('chatmeter:locationchange', checkForChatSwitch);

  // Fallback polling in case some navigation path doesn't trigger the
  // patched history events (defensive, low-cost interval). Skipped
  // while "Analyse All Chats" is actively navigating between chats,
  // since that flow intentionally changes the URL many times and
  // manages stats itself.
  setInterval(() => {
    if (analyseAllBtn.disabled) return; // scan-all in progress
    checkForChatSwitch();
  }, 1500);

  const bodyObserver = new MutationObserver(() => {
    if (analyseAllBtn.disabled) return; // scan-all in progress
    checkForChatSwitch();
  });

  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();

let snippets = [];
let currentEditId = null;
let currentUseId = null;
let filteredSnippets = [];
let currentPreviewText = '';
let sortOrder = 'default';
let usageStats = {};
let recentSnippets = [];
let settings = {
  theme: 'auto'
};

const snippetsList = document.getElementById('snippetsList');
const addForm = document.getElementById('addForm');
const editForm = document.getElementById('editForm');
const useForm = document.getElementById('useForm');
const settingsPanel = document.getElementById('settingsPanel');
const addBtn = document.getElementById('addBtn');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const updateBtn = document.getElementById('updateBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const closeUseBtn = document.getElementById('closeUseBtn');
const copyBtn = document.getElementById('copyBtn');
const inputFields = document.getElementById('inputFields');
const preview = document.getElementById('preview');
const searchInput = document.getElementById('searchInput');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const placeholderBtn = document.getElementById('placeholderBtn');
const editPlaceholderBtn = document.getElementById('editPlaceholderBtn');
const themeSelect = document.getElementById('themeSelect');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

function extractPlaceholders(text) {
  const regex = /\$\{([^}]+)\}/g;
  const placeholders = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!placeholders.includes(match[1])) {
      placeholders.push(match[1]);
    }
  }
  return placeholders;
}

function loadSnippets() {
  chrome.storage.local.get(['snippets', 'settings', 'usageStats', 'recentSnippets'], (result) => {
    snippets = result.snippets || [];
    if (result.settings) {
      settings = { ...settings, ...result.settings };
    }
    usageStats = result.usageStats || {};
    recentSnippets = result.recentSnippets || [];
    applySettings();
    filteredSnippets = snippets;
    renderSnippets();
    updateUsageStats();
    updateRecentSnippets();
  });
}

function saveSnippets() {
  chrome.storage.local.set({ snippets });
}

function saveUsageStats() {
  chrome.storage.local.set({ usageStats });
}

function saveRecentSnippets() {
  chrome.storage.local.set({ recentSnippets });
}

function saveSettings() {
  chrome.storage.local.set({ settings });
}

function applySettings() {
  if (settings.theme === 'light') {
    document.body.classList.add('light-theme');
  } else if (settings.theme === 'dark') {
    document.body.classList.remove('light-theme');
  } else if (settings.theme === 'auto') {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
    }
  }

  if (themeSelect) themeSelect.value = settings.theme || 'auto';
}

function adjustColor(color, amount) {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function filterSnippets(searchTerm) {
  if (!searchTerm.trim()) {
    filteredSnippets = [];
  } else {
    const term = searchTerm.toLowerCase();
    filteredSnippets = snippets.filter(snippet =>
      snippet.name.toLowerCase().includes(term) ||
      snippet.text.toLowerCase().includes(term) ||
      (snippet.category && snippet.category.toLowerCase().includes(term))
    );
  }
  renderSnippets();
}

function sortSnippets(snippetsToSort) {
  const sorted = [...snippetsToSort];

  switch (sortOrder) {
    case 'default':
      sorted.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return 0;
      });
      break;
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'date':
      sorted.reverse();
      break;
  }

  return sorted;
}

function toggleSort() {
  const orders = ['default', 'name', 'name-desc', 'date'];
  const currentIndex = orders.indexOf(sortOrder);
  sortOrder = orders[(currentIndex + 1) % orders.length];

  const sortBtn = document.getElementById('sortBtn');
  const icons = ['🔀', '🔤', '🔤', '📅'];
  sortBtn.textContent = icons[orders.indexOf(sortOrder)];
  sortBtn.title = `Sort: ${sortOrder === 'default' ? 'Default First' : sortOrder === 'name' ? 'Name (A-Z)' : sortOrder === 'name-desc' ? 'Name (Z-A)' : 'Date'}`;

  renderSnippets();
}

function toggleDefault(index) {
  if (snippets[index].isDefault) {
    snippets[index].isDefault = false;
  } else {
    snippets.forEach(s => s.isDefault = false);
    snippets[index].isDefault = true;
  }
  saveSnippets();
  renderSnippets();
}

function renderSnippets() {
  snippetsList.innerHTML = ''
  let snippetsToRender = searchInput && searchInput.value.trim() ? filteredSnippets : snippets
  snippetsToRender = sortSnippets(snippetsToRender)
  if (snippetsToRender.length === 0) {
    snippetsList.innerHTML = '<div class="empty-state">No snippets found. Click "Add Snippet" to create one.</div>'
    return
  }
  snippetsToRender.forEach(snippet => {
    const originalIndex = snippets.indexOf(snippet)
    const item = document.createElement('div')
    item.className = 'snippet-item'
    if (snippet.isDefault) item.classList.add('snippet-default')
    const info = document.createElement('div')
    info.className = 'snippet-info'
    const nameRow = document.createElement('div')
    nameRow.style.display = 'flex'
    nameRow.style.alignItems = 'center'
    nameRow.style.gap = '6px'
    const defaultBtn = document.createElement('button')
    defaultBtn.className = 'btn-icon-small'
    defaultBtn.innerHTML = snippet.isDefault ? '⭐' : '☆'
    defaultBtn.onclick = e => {
      e.stopPropagation()
      toggleDefault(originalIndex)
    }
    const name = document.createElement('div')
    name.className = 'snippet-name'
    name.textContent = snippet.name
    nameRow.appendChild(defaultBtn)
    nameRow.appendChild(name)
    info.appendChild(nameRow)
    const preview = document.createElement('div')
    preview.className = 'snippet-preview'
    preview.textContent = snippet.text
    info.appendChild(preview)
    const actions = document.createElement('div')
    actions.className = 'snippet-actions'
    const copyBtn = document.createElement('button')
    copyBtn.className = 'btn-small'
    copyBtn.textContent = 'Copy'
    copyBtn.onclick = e => {
      e.stopPropagation()
      const cleanText = snippet.text.replace(/\$\{[^}]+\}/g, "")
      navigator.clipboard.writeText(cleanText)
    }
    const editBtn = document.createElement('button')
    editBtn.className = 'btn-small'
    editBtn.textContent = 'Edit'
    editBtn.onclick = e => {
      e.stopPropagation()
      editSnippet(originalIndex)
    }
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn-danger'
    deleteBtn.textContent = 'Delete'
    deleteBtn.onclick = e => {
      e.stopPropagation()
      deleteSnippet(originalIndex)
    }
    actions.appendChild(copyBtn)
    actions.appendChild(editBtn)
    actions.appendChild(deleteBtn)
    item.appendChild(info)
    item.appendChild(actions)
    item.onclick = () => navigator.clipboard.writeText(snippet.text)
    snippetsList.appendChild(item)
  })
}


function showAddForm() {
  addForm.classList.remove('hidden');
  editForm.classList.add('hidden');
  useForm.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  document.getElementById('snippetName').value = '';
  document.getElementById('snippetText').value = '';
  document.getElementById('snippetCategory').value = '';
  document.getElementById('snippetName').focus();
}

function hideAddForm() {
  addForm.classList.add('hidden');
}

function showEditForm() {
  editForm.classList.remove('hidden');
  addForm.classList.add('hidden');
  useForm.classList.add('hidden');
  settingsPanel.classList.add('hidden');
}

function hideEditForm() {
  editForm.classList.add('hidden');
}

function showUseForm() {
  useForm.classList.remove('hidden');
  addForm.classList.add('hidden');
  editForm.classList.add('hidden');
  settingsPanel.classList.add('hidden');
}

function hideUseForm() {
  useForm.classList.add('hidden');
}

function showSettings() {
  settingsPanel.classList.remove('hidden');
  addForm.classList.add('hidden');
  editForm.classList.add('hidden');
  useForm.classList.add('hidden');
}

function hideSettings() {
  settingsPanel.classList.add('hidden');
}

function insertPlaceholder(textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  const start = textarea.selectionStart;
  const placeholderText = prompt('Enter placeholder name:', 'name');
  if (placeholderText) {
    const placeholder = `\${${placeholderText}}`;
    textarea.value = textarea.value.substring(0, start) + placeholder + textarea.value.substring(start);
    textarea.focus();
    textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
  }
}

function saveSnippet() {
  const name = document.getElementById('snippetName').value.trim();
  const text = document.getElementById('snippetText').value.trim();
  const category = document.getElementById('snippetCategory').value.trim();

  if (!name || !text) {
    alert('Please fill in both name and text fields.');
    return;
  }

  const snippet = { name, text };
  if (category) snippet.category = category;

  snippets.push(snippet);
  saveSnippets();
  filteredSnippets = snippets;
  renderSnippets();
  hideAddForm();
}

function editSnippet(index) {
  currentEditId = index;
  const snippet = snippets[index];
  document.getElementById('editSnippetName').value = snippet.name;
  document.getElementById('editSnippetText').value = snippet.text;
  document.getElementById('editSnippetCategory').value = snippet.category || '';
  showEditForm();
}

function updateSnippet() {
  const name = document.getElementById('editSnippetName').value.trim();
  const text = document.getElementById('editSnippetText').value.trim();
  const category = document.getElementById('editSnippetCategory').value.trim();

  if (!name || !text) {
    alert('Please fill in both name and text fields.');
    return;
  }

  if (currentEditId !== null) {
    const snippet = { name, text };
    if (category) snippet.category = category;
    snippets[currentEditId] = snippet;
    saveSnippets();
    filteredSnippets = snippets;
    renderSnippets();
    hideEditForm();
    currentEditId = null;
  }
}

function deleteSnippet(index) {
  if (confirm('Are you sure you want to delete this snippet?')) {
    snippets.splice(index, 1);
    saveSnippets();
    if (searchInput && searchInput.value.trim()) {
      filterSnippets(searchInput.value);
    } else {
      renderSnippets();
    }
  }
}

function useSnippet(index) {
  currentUseId = index;
  const snippet = snippets[index];
  const placeholders = extractPlaceholders(snippet.text);

  usageStats[index] = (usageStats[index] || 0) + 1;
  saveUsageStats();

  const recentIndex = recentSnippets.indexOf(index);
  if (recentIndex > -1) {
    recentSnippets.splice(recentIndex, 1);
  }
  recentSnippets.unshift(index);
  if (recentSnippets.length > 5) {
    recentSnippets.pop();
  }
  saveRecentSnippets();

  document.getElementById('useFormTitle').textContent = `🚀 Use: ${snippet.name}`;
  inputFields.innerHTML = '';

  placeholders.forEach((placeholder, index) => {
    const field = document.createElement('div');
    field.className = 'input-field';

    const label = document.createElement('label');
    label.textContent = placeholder;
    label.setAttribute('for', `input-${placeholder}`);

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `input-${placeholder}`;
    input.placeholder = `Enter ${placeholder}`;
    if (snippet.defaults && snippet.defaults[placeholder]) {
      input.value = snippet.defaults[placeholder];
    }
    input.addEventListener('input', updatePreview);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (index < placeholders.length - 1) {
          const nextInput = document.getElementById(`input-${placeholders[index + 1]}`);
          if (nextInput) nextInput.focus();
        } else {
          copyToClipboard();
        }
      }
    });

    field.appendChild(label);
    field.appendChild(input);
    inputFields.appendChild(field);
  });

  updatePreview();
  showUseForm();

  if (placeholders.length > 0) {
    setTimeout(() => {
      const firstInput = document.getElementById(`input-${placeholders[0]}`);
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    }, 100);
  }
}

function updatePreview() {
  if (currentUseId === null) return;

  const snippet = snippets[currentUseId];
  let previewText = snippet.text;
  const placeholders = extractPlaceholders(snippet.text);

  placeholders.forEach((placeholder) => {
    const input = document.getElementById(`input-${placeholder}`);
    const value = input ? input.value : '';
    const regex = new RegExp(`\\$\\{${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g');
    previewText = previewText.replace(regex, value);
  });

  currentPreviewText = previewText;
  preview.innerHTML = formatPreview(previewText);
}

function insertFormat(textarea, before, after) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  const newText = before + selectedText + after;
  textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
}

function applyFormat(format, targetId) {
  const textarea = document.getElementById(targetId || 'snippetText');
  if (!textarea) return;

  switch (format) {
    case 'bold':
      insertFormat(textarea, '**', '**');
      break;
    case 'italic':
      insertFormat(textarea, '*', '*');
      break;
    case 'underline':
      insertFormat(textarea, '<u>', '</u>');
      break;
    case 'code':
      insertFormat(textarea, '`', '`');
      break;
    case 'heading':
      insertFormat(textarea, '# ', '');
      break;
  }
}

function formatPreview(text) {
  let formatted = text;
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/<u>(.*?)<\/u>/g, '<u>$1</u>');
  formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
  formatted = formatted.replace(/^# (.*)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

function copyToClipboard() {
  const text = currentPreviewText || preview.textContent || preview.innerText;

  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = '✅ Copied!';
    copyBtn.style.background = '#34a853';
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy';
      copyBtn.style.background = '';
    }, 2000);
  }).catch((err) => {
    alert('Failed to copy to clipboard: ' + err);
  });
}

function updateUsageStats() {
  const statsContainer = document.getElementById('usageStats');
  if (!statsContainer) return;

  if (Object.keys(usageStats).length === 0) {
    statsContainer.innerHTML = '<div class="empty-stats">No usage data yet</div>';
    return;
  }

  const sorted = Object.entries(usageStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  statsContainer.innerHTML = sorted.map(([index, count]) => {
    const snippet = snippets[parseInt(index)];
    if (!snippet) return '';
    return `<div class="stat-item"><span class="stat-name">${snippet.name}</span><span class="stat-count">${count}x</span></div>`;
  }).join('');
}

function updateRecentSnippets() {
  const recentContainer = document.getElementById('recentSnippets');
  if (!recentContainer) return;

  if (recentSnippets.length === 0) {
    recentContainer.innerHTML = '<div class="empty-stats">No recent snippets</div>';
    return;
  }

  recentContainer.innerHTML = recentSnippets.slice(0, 5).map(index => {
    const snippet = snippets[parseInt(index)];
    if (!snippet) return '';
    return `<div class="recent-item" onclick="useSnippet(${index})">${snippet.name}</div>`;
  }).join('');
}

function applyTemplate(templateType) {
  const templates = {
    email: {
      name: 'Email Template',
      text: 'Subject: ${subject}\n\nDear ${name},\n\n${message}\n\nBest regards,\n${sender}',
      category: 'Email',
      sample: 'Subject: Project Update\n\nDear John,\n\nI wanted to provide you with an update on the project status.\n\nBest regards,\nSarah'
    },
    code: {
      name: 'Code Block',
      text: '```${language}\n${code}\n```',
      category: 'Code',
      sample: '```javascript\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n```'
    },
    meeting: {
      name: 'Meeting Notes',
      text: 'Meeting: ${title}\nDate: ${date}\nAttendees: ${attendees}\n\nAgenda:\n${agenda}\n\nNotes:\n${notes}',
      category: 'Meeting',
      sample: 'Meeting: Weekly Standup\nDate: 2024-01-15\nAttendees: Team A, Team B\n\nAgenda:\n- Review progress\n- Discuss blockers\n\nNotes:\n- Project on track\n- Need to address deployment issue'
    },
    todo: {
      name: 'Todo List',
      text: '## ${title}\n\n- [ ] ${task1}\n- [ ] ${task2}\n- [ ] ${task3}',
      category: 'Todo',
      sample: '## Daily Tasks\n\n- [ ] Review code changes\n- [ ] Update documentation\n- [ ] Test new features'
    },
    greeting: {
      name: 'Greeting',
      text: 'Hello ${name},\n\n${message}\n\n${closing}',
      category: 'Greeting',
      sample: 'Hello Alex,\n\nI hope this message finds you well. I wanted to reach out regarding our upcoming collaboration.\n\nBest regards'
    },
    signature: {
      name: 'Signature',
      text: '${name}\n${title}\n${company}\n${email}\n${phone}',
      category: 'Signature',
      sample: 'John Doe\nSenior Developer\nTech Corp\njohn.doe@techcorp.com\n+1 (555) 123-4567'
    }
  };

  const template = templates[templateType];
  if (!template) return;

  document.getElementById('snippetName').value = template.name;
  document.getElementById('snippetCategory').value = template.category;
  document.getElementById('snippetText').value = template.text + '\n\n---\nExample:\n' + template.sample;
  showAddForm();
  hideSettings();

  setTimeout(() => {
    const textarea = document.getElementById('snippetText');
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(0, template.text.length);
    }
  }, 100);
}

function clearStats() {
  if (confirm('Clear all usage statistics?')) {
    usageStats = {};
    recentSnippets = [];
    saveUsageStats();
    saveRecentSnippets();
    updateUsageStats();
    updateRecentSnippets();
  }
}

function exportSnippets() {
  const dataStr = JSON.stringify(snippets, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'snippets-' + new Date().toISOString().split('T')[0] + '.json';
  link.click();
  URL.revokeObjectURL(url);
}

function importSnippets(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        if (confirm(`Import ${imported.length} snippet(s)? This will add them to your existing snippets.`)) {
          snippets = [...snippets, ...imported];
          saveSnippets();
          filteredSnippets = snippets;
          renderSnippets();
          alert('Snippets imported successfully!');
        }
      } else {
        alert('Invalid file format.');
      }
    } catch (err) {
      alert('Error importing snippets: ' + err.message);
    }
  };
  reader.readAsText(file);
}

addBtn.addEventListener('click', showAddForm);
saveBtn.addEventListener('click', saveSnippet);
cancelBtn.addEventListener('click', hideAddForm);
updateBtn.addEventListener('click', updateSnippet);
cancelEditBtn.addEventListener('click', hideEditForm);
closeUseBtn.addEventListener('click', hideUseForm);
copyBtn.addEventListener('click', copyToClipboard);
settingsBtn.addEventListener('click', showSettings);
closeSettingsBtn.addEventListener('click', hideSettings);
document.getElementById('sortBtn').addEventListener('click', toggleSort);

placeholderBtn.addEventListener('click', () => insertPlaceholder('snippetText'));
editPlaceholderBtn.addEventListener('click', () => insertPlaceholder('editSnippetText'));

searchInput.addEventListener('input', (e) => filterSnippets(e.target.value));

document.querySelectorAll('.format-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const format = e.target.getAttribute('data-format');
    if (format) {
      const target = e.target.getAttribute('data-target');
      applyFormat(format, target);
    }
  });
});

document.getElementById('snippetText').addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'p') {
    e.preventDefault();
    insertPlaceholder('snippetText');
  }
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault();
    applyFormat('bold', 'snippetText');
  }
  if (e.ctrlKey && e.key === 'i') {
    e.preventDefault();
    applyFormat('italic', 'snippetText');
  }
  if (e.ctrlKey && e.key === 'u') {
    e.preventDefault();
    applyFormat('underline', 'snippetText');
  }
});

document.getElementById('editSnippetText').addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'p') {
    e.preventDefault();
    insertPlaceholder('editSnippetText');
  }
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault();
    applyFormat('bold', 'editSnippetText');
  }
  if (e.ctrlKey && e.key === 'i') {
    e.preventDefault();
    applyFormat('italic', 'editSnippetText');
  }
  if (e.ctrlKey && e.key === 'u') {
    e.preventDefault();
    applyFormat('underline', 'editSnippetText');
  }
});

if (themeSelect) {
  themeSelect.addEventListener('change', (e) => {
    settings.theme = e.target.value;
    saveSettings();
    applySettings();
  });
}

document.querySelectorAll('.template-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const template = e.target.getAttribute('data-template');
    applyTemplate(template);
    hideSettings();
  });
});

if (document.getElementById('clearStatsBtn')) {
  document.getElementById('clearStatsBtn').addEventListener('click', clearStats);
}

exportBtn.addEventListener('click', exportSnippets);
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    importSnippets(e.target.files[0]);
    e.target.value = '';
  }
});

document.querySelectorAll('.template-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const template = e.target.getAttribute('data-template');
    applyTemplate(template);
  });
});

if (document.getElementById('clearStatsBtn')) {
  document.getElementById('clearStatsBtn').addEventListener('click', clearStats);
}

if (themeSelect) {
  themeSelect.addEventListener('change', (e) => {
    settings.theme = e.target.value;
    saveSettings();
    applySettings();
  });
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (settings.theme === 'auto') {
      applySettings();
    }
  });
}

loadSnippets();

// theme
const tt = document.getElementById("themeToggleBtn")
const tb = document.body

if (settings.theme !== "light") settings.theme = "dark"
tt.textContent = settings.theme === "light" ? "☀️" : "🌙"
applySettings()

tt.onclick = () => {
  settings.theme = settings.theme === "light" ? "dark" : "light"
  saveSettings()
  applySettings()
  tt.textContent = settings.theme === "light" ? "☀️" : "🌙"
}

// readme
chrome.runtime.onInstalled.addListener(d => {
  if (d.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("README.md") })
  }
})

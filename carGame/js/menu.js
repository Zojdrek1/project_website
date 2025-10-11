// Main menu overlay with save slots and new-game options

import { CURRENCY_RATES } from './economy.js';
import { generateUniqueAlias } from './progression.js';
import { isAliasTaken } from './leaderboard.js';
import { listSlotSummaries, getSlotSummary } from './state.js';
import { el, getIconSVG } from './ui.js';

const CURRENCIES = [
  ['USD', 'US Dollar'],
  ['GBP', 'British Pound'],
  ['EUR', 'Euro'],
  ['JPY', 'Japanese Yen'],
  ['PLN', 'Polish Złoty'],
];

const NEW_GAME_BASE_USD = { easy: 40000, standard: 20000, hard: 12000 };

let root = null;
let slotsContainer = null;
let newGamePanel = null;
let newGameForm = null;
let newGameTitle = null;
let newGameAlias = null;
let newGameDifficulty = null;
let newGameCurrency = null;
let newGameStartingPreview = null;
let newGameError = null;
let newGameStartBtn = null;
let optionsRef = null;
let pendingSlot = null;
let quickResumeBtn = null;
let quickResumeNote = null;

const updateStartingMoneyDisplay = () => {
  if (!newGameStartingPreview) return;
  const difficulty = newGameDifficulty ? newGameDifficulty.value : 'standard';
  const currency = newGameCurrency ? newGameCurrency.value : 'USD';
  const amount = startingMoneyFor(difficulty, currency);
  let label;
  try { label = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
  catch { label = `${currency} ${amount}`; }
  const diffText = difficultyLabel[difficulty] || 'Medium';
  newGameStartingPreview.textContent = `Starting Money: ${label} (${diffText})`;
  return amount;
};

const ensureRoot = () => {
  if (root) return;
  root = el('div', { id: 'mainMenu', class: 'main-menu' });
  const backdrop = el('div', { class: 'menu-backdrop' });

  const content = el('div', { class: 'menu-content' });

  const logo = el('img', { class: 'menu-logo', src: 'Assets/logo.png', alt: 'Illegal Car Sales logo' });
  const subtitle = el('p', { class: 'menu-subtitle', text: 'Underground trading, razor-thin margins, and plenty of heat.' });
  const featureList = el('ul', { class: 'menu-features' }, [
    el('li', { text: '⚙️ Tune your rides with legal or illegal parts.' }),
    el('li', { text: '💸 Flip cars across dynamic black-market prices.' }),
    el('li', { text: '🏁 Risk races for cash, glory, and growing heat.' }),
  ]);

  quickResumeBtn = el('button', { class: 'btn primary menu-quick', text: 'Continue Last Save', disabled: true });
  quickResumeNote = el('div', { class: 'menu-hero-note', text: 'No save selected yet — choose a slot to begin.' });
  const heroActions = el('div', { class: 'menu-hero-actions' }, [quickResumeBtn, quickResumeNote]);

  const hero = el('div', { class: 'menu-hero' }, [logo, subtitle, featureList, heroActions]);

  slotsContainer = el('div', { class: 'menu-slots' });
  const slotsHeader = el('div', { class: 'slots-header' }, [
    el('h2', { class: 'slots-title', text: 'Select a Profile' }),
    el('p', { class: 'slots-subtitle', text: 'Three save spots to build unique empires.' }),
  ]);
  const slotsFootnote = el('div', { class: 'slots-footnote', text: 'Tip: Each slot keeps its own currency, upgrades, and reputation.' });
  const slotsWrap = el('div', { class: 'menu-slots-wrap' }, [slotsHeader, slotsContainer, slotsFootnote]);

  const mainPanel = el('div', { class: 'menu-main' }, [hero, slotsWrap]);

  newGameTitle = el('h2', { class: 'menu-newgame-title', text: 'New Game' });
  newGameAlias = el('input', {
    type: 'text',
    class: 'menu-input',
    id: 'newGameAlias',
    maxLength: 24,
    placeholder: 'Crew alias',
    autocomplete: 'off',
  });
  const aliasLabel = el('label', { for: 'newGameAlias', class: 'menu-label', text: 'Crew Alias' });

  newGameDifficulty = el('select', { class: 'menu-input', id: 'newGameDifficulty' });
  [['easy', 'Easy'], ['standard', 'Medium'], ['hard', 'Hard']]
    .forEach(([value, label]) => newGameDifficulty.appendChild(el('option', { value, text: label, selected: value === 'standard' })));
  const difficultyLabel = el('label', { for: 'newGameDifficulty', class: 'menu-label', text: 'Difficulty' });
  newGameDifficulty.onchange = updateStartingMoneyDisplay;

  newGameCurrency = el('select', { class: 'menu-input', id: 'newGameCurrency' });
  for (const [code, name] of CURRENCIES) {
    const opt = el('option', { value: code, text: `${code} — ${name}` });
    newGameCurrency.appendChild(opt);
  }
  newGameCurrency.onchange = updateStartingMoneyDisplay;

  const currencyLabel = el('label', { for: 'newGameCurrency', class: 'menu-label', text: 'Currency' });

  newGameError = el('div', { class: 'menu-error', text: '' });

  const cancelBtn = el('button', { type: 'button', class: 'btn', text: 'Cancel' });
  cancelBtn.onclick = () => closeNewGamePanel();
  newGameStartBtn = el('button', { type: 'submit', class: 'btn primary', text: 'Start Game' });

  const actions = el('div', { class: 'menu-actions' }, [cancelBtn, newGameStartBtn]);
  const generateBtn = el('button', { type: 'button', class: 'btn' });
  generateBtn.innerHTML = getIconSVG('refresh') + ' Generate';
  generateBtn.style.marginLeft = 'auto';
  generateBtn.onclick = async () => {
    if (newGameAlias) {
      newGameAlias.value = await generateUniqueAlias();
      updateStartBtn();
    }
  };

  newGameStartingPreview = el('div', { class: 'menu-starting-preview', text: '' });

  newGameForm = el('form', { class: 'menu-newgame-form' }, [
    newGameTitle,
    el('p', { class: 'menu-newgame-note', text: 'Choose your starting conditions. This will overwrite the selected slot.' }),
    newGameStartingPreview,
    aliasLabel,
    newGameAlias,
    difficultyLabel,
    newGameDifficulty,
    currencyLabel,
    newGameCurrency,
    newGameError,
    el('div', { class: 'menu-actions' }, [cancelBtn, generateBtn, newGameStartBtn]),
  ]);

  newGameForm.onsubmit = (e) => {
    e.preventDefault();
    handleNewGameSubmit();
  };
  const updateStartBtn = () => {
    if (!newGameStartBtn) return;
    const alias = newGameAlias ? newGameAlias.value.trim() : '';
    newGameStartBtn.disabled = !alias;
    if (alias && newGameError) newGameError.textContent = '';
  };
  if (newGameAlias) {
    newGameAlias.addEventListener('input', updateStartBtn);
    newGameAlias.addEventListener('blur', updateStartBtn);
  }
  updateStartingMoneyDisplay();
  updateStartBtn();

  newGamePanel = el('div', { class: 'menu-newgame' }, [newGameForm]);

  content.appendChild(mainPanel);
  content.appendChild(newGamePanel);

  root.appendChild(backdrop);
  root.appendChild(content);
  document.body.appendChild(root);

  document.addEventListener('keydown', handleKeyDown, { passive: true });
};

const handleKeyDown = (evt) => {
  if (evt.key === 'Escape') {
    if (pendingSlot !== null) {
      closeNewGamePanel();
    }
  }
};

const renderSlots = () => {
  if (!slotsContainer) return;
  slotsContainer.innerHTML = '';
  const summaries = listSlotSummaries();
  summaries.forEach((summary, idx) => {
    const card = renderSlotCard(summary, idx);
    slotsContainer.appendChild(card);
  });
  updateQuickResume(summaries);
};

const difficultyLabel = {
  easy: 'Easy',
  standard: 'Medium',
  hard: 'Hard',
};

const formatMoney = (amount, currency) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${currency} ${Math.round(amount)}`; }
};

const startingMoneyFor = (difficulty, currency) => {
  const base = NEW_GAME_BASE_USD[difficulty] ?? NEW_GAME_BASE_USD.standard;
  const rate = CURRENCY_RATES[currency] ?? 1;
  const converted = Math.round(base * rate);
  const step = currency === 'JPY' ? 1000 : 500;
  return Math.max(step, Math.round(converted / step) * step);
};

const updateQuickResume = (summaries) => {
  if (!quickResumeBtn || !quickResumeNote) return;
  const playable = Array.isArray(summaries) ? summaries.filter(Boolean) : [];
  if (!playable.length || !optionsRef || typeof optionsRef.onLoadGame !== 'function') {
    quickResumeBtn.disabled = true;
    quickResumeBtn.textContent = 'Continue Last Save';
    quickResumeNote.textContent = 'No save selected yet — choose a slot to begin.';
    quickResumeBtn.onclick = () => {};
    return;
  }
  const latest = playable.slice().sort((a, b) => {
    const aa = (a.lastPlayed ?? a.createdAt ?? 0);
    const bb = (b.lastPlayed ?? b.createdAt ?? 0);
    return bb - aa;
  })[0];
  quickResumeBtn.disabled = false;
  const diffText = difficultyLabel[latest.difficulty] || 'Medium';
  quickResumeBtn.textContent = `Continue Slot ${latest.slot + 1}`;
  quickResumeNote.textContent = `${latest.alias || 'Crew'} • ${diffText} • ${formatMoney(latest.money, latest.currency)} — Level ${latest.level}`;
  quickResumeBtn.onclick = () => {
    if (!optionsRef || typeof optionsRef.onLoadGame !== 'function') return;
    const result = optionsRef.onLoadGame(latest.slot);
    if (result && typeof result.then === 'function') {
      quickResumeBtn.disabled = true;
      result.finally(() => { quickResumeBtn.disabled = false; });
    } else if (result === false) {
      quickResumeBtn.disabled = false;
    }
  };
};

const renderSlotCard = (summary, index) => {
  const chip = summary
    ? el('span', { class: 'slot-chip', text: summary.currency })
    : el('span', { class: 'slot-chip empty', text: 'Empty' });
  const header = el('div', { class: 'slot-header' }, [
    el('span', { class: 'slot-name', text: `Slot ${index + 1}` }),
    chip,
    el('span', { class: 'slot-status' + (summary ? '' : ' empty'), text: summary ? 'Saved Game' : 'Available' }),
  ]);

  const body = summary
    ? el('div', { class: 'slot-body' }, [
        el('div', { class: 'slot-meta', text: `Alias: ${summary.alias || 'Crew'}` }),
        el('div', { class: 'slot-meta', text: `Difficulty: ${difficultyLabel[summary.difficulty] || 'Medium'}` }),
        el('div', { text: `Level ${summary.level}` }),
        el('div', { text: formatMoney(summary.money, summary.currency) }),
        summary.lastPlayed
          ? el('div', { class: 'slot-meta', text: `Last played: ${new Date(summary.lastPlayed).toLocaleString()}` })
          : el('div', { class: 'slot-meta', text: 'Never played' }),
      ])
    : el('div', { class: 'slot-body empty', text: 'No save data yet.' });

  const loadBtn = el('button', {
    class: 'btn primary',
    text: summary ? 'Resume' : 'Resume',
    disabled: summary ? false : true,
  });
  loadBtn.onclick = () => {
    if (!summary || !optionsRef || typeof optionsRef.onLoadGame !== 'function') return;
    if (loadBtn.disabled) return;
    try {
      const result = optionsRef.onLoadGame(index);
      if (result && typeof result.then === 'function') {
        loadBtn.disabled = true;
        result.finally(() => { loadBtn.disabled = false; });
      }
    } catch {
      loadBtn.disabled = false;
    }
  };

  const newBtn = el('button', { class: 'btn', text: summary ? 'Overwrite' : 'Create Profile' });
  newBtn.onclick = () => openNewGamePanel(index, summary);

  const btnRow = summary
    ? el('div', { class: 'slot-actions' }, [loadBtn, newBtn])
    : el('div', { class: 'slot-actions' }, [el('button', { class: 'btn primary', text: 'Create Profile', onclick: () => openNewGamePanel(index, summary) })]);

  const card = el('div', { class: 'menu-slot-card' }, [header, body, btnRow]);
  return card;
};

const openNewGamePanel = (slotIndex, summary) => {
  ensureRoot();
  pendingSlot = slotIndex;
  newGameError.textContent = '';
  newGameTitle.textContent = `New Game — Slot ${slotIndex + 1}`;
  if (newGameAlias) newGameAlias.value = summary && summary.alias ? summary.alias : '';
  if (summary && summary.difficulty && newGameDifficulty) newGameDifficulty.value = summary.difficulty;
  else if (newGameDifficulty) newGameDifficulty.value = 'standard';
  if (summary && summary.currency) newGameCurrency.value = summary.currency; else newGameCurrency.value = 'USD';
  if (newGameStartBtn) newGameStartBtn.disabled = !(newGameAlias && newGameAlias.value.trim());
  root.classList.add('newgame-open');
  newGamePanel.classList.add('open');
  if (newGameAlias) newGameAlias.focus();
  updateStartingMoneyDisplay();
};

const closeNewGamePanel = () => {
  pendingSlot = null;
  if (newGamePanel) newGamePanel.classList.remove('open');
  if (root) root.classList.remove('newgame-open');
  if (newGameError) newGameError.textContent = '';
  if (newGameStartBtn) newGameStartBtn.disabled = false;
};

const handleNewGameSubmit = async () => {
  if (pendingSlot === null) return;
  const alias = newGameAlias ? newGameAlias.value.trim() : '';
  if (!alias) {
    newGameError.textContent = 'Enter a crew alias to begin.';
    if (newGameAlias) newGameAlias.focus();
    return;
  }

  if (newGameStartBtn) newGameStartBtn.disabled = true;
  newGameError.textContent = 'Checking alias...';
  const taken = await isAliasTaken(alias);
  if (taken) {
    newGameError.textContent = 'This alias is already taken. Please choose another.';
    if (newGameStartBtn) newGameStartBtn.disabled = false;
    return;
  }

  const currency = (newGameCurrency && newGameCurrency.value) || 'USD';
  const difficulty = (newGameDifficulty && newGameDifficulty.value) || 'standard';
  const money = startingMoneyFor(difficulty, currency);
  const payload = { alias, currency, difficulty, money };
  const handler = optionsRef && typeof optionsRef.onNewGame === 'function' ? optionsRef.onNewGame : null;
  const finish = () => {
    closeNewGamePanel();
    renderSlots();
    hideMainMenu();
  };
  if (!handler) {
    finish();
    return;
  }
  try {
    const result = handler(pendingSlot, payload);
    if (result && typeof result.then === 'function') {
      if (newGameStartBtn) newGameStartBtn.disabled = true;
      result.then((outcome) => {
        if (outcome === false) {
          if (newGameStartBtn) newGameStartBtn.disabled = false;
          newGameError.textContent = 'Unable to start new game. Please try again.';
          return;
        }
        finish();
      }).catch(() => {
        if (newGameStartBtn) newGameStartBtn.disabled = false;
        newGameError.textContent = 'Unable to start new game. Please try again.';
      });
      return;
    }
    if (result === false) {
      newGameError.textContent = 'Unable to start new game. Please try again.';
      return;
    }
    finish();
  } catch {
    if (newGameStartBtn) newGameStartBtn.disabled = false;
    newGameError.textContent = 'Unable to start new game. Please try again.';
  }
};

export function showMainMenu(options = {}) {
  optionsRef = options;
  ensureRoot();
  renderSlots();
  document.body.classList.add('menu-active');
  root.classList.add('open');
}

export function hideMainMenu() {
  if (!root) return;
  root.classList.remove('open');
  document.body.classList.remove('menu-active');
  closeNewGamePanel();
}

export function refreshMainMenuSlots() {
  if (!root) return;
  renderSlots();
}

export function teardownMainMenu() {
  if (!root) return;
  document.removeEventListener('keydown', handleKeyDown);
  root.remove();
  root = null;
  slotsContainer = null;
  newGamePanel = null;
  newGameForm = null;
  newGameTitle = null;
  newGameCurrency = null;
  newGameError = null;
  pendingSlot = null;
  optionsRef = null;
}

export function peekSlot(slotIndex) {
  return getSlotSummary(slotIndex);
}

export function openNewGameForSlot(slotIndex) {
  if (!root) ensureRoot();
  if (!optionsRef) return;
  if (!root.classList.contains('open')) {
    document.body.classList.add('menu-active');
    root.classList.add('open');
  }
  renderSlots();
  const summary = getSlotSummary(slotIndex);
  openNewGamePanel(slotIndex, summary);
}

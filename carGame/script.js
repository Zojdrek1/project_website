// --- Utility helpers ---
import { PARTS, MODELS } from './js/data.js';
import { state, setState, defaultState, saveState, loadState, migrateState } from './js/state.js';
import { canRace, simulateRaceOutcome } from './js/race.js';
import { ensureModelTrends, refreshIllegalMarket, refreshPartsPrices, tickPartsPricesCore, tickIllegalMarketCore, PRICE_HISTORY_MAX, PARTS_TICK_MS, ILLEGAL_TICK_MS, ILLEGAL_LISTING_REFRESH_MS } from './js/economy.js';
import { el, ensureToasts, showToast, getIconSVG, renderNavUI, renderCenterNavUI, drawSparkline, renderMarketView, updateMarketPricesAndTrendsUI, renderGarageFullView, renderPartsView, updatePartsPricesUI as updatePartsPricesUI_M, renderRacesView, layoutCarBreakdown, getBodyStyle, getSilhouettePath } from './js/ui.js';
let fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
function currencySymbol() {
  try {
    const code = (state && state.currency) || 'USD';
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 0 }).formatToParts(0);
    const p = parts.find(x => x.type === 'currency');
    return p ? p.value : '$';
  } catch { return '$'; }
}
const rand = (min, max) => Math.random() * (max - min) + min;
const randi = (min, max) => Math.floor(rand(min, max));
const sample = (arr) => arr[randi(0, arr.length)];
const chance = (p) => Math.random() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const CURRENCY_RATES = { USD: 1, GBP: 0.79, EUR: 0.93, JPY: 155, PLN: 4.0 };
const getRate = () => CURRENCY_RATES[(state && state.currency) || 'USD'] || 1;

// --- Game Data ---
// PARTS and MODELS moved to ./js/data.js

// --- State ---
// State helpers moved to ./js/state.js

let partsTicker = null;
let illegalTicker = null;
let renderTimer = null;
const RERENDER_DEBOUNCE_MS = 900; // coalesce frequent updates
let illegalRefreshTimer = null;
let stickyMeasureTimer = null;
let loaderHidden = false;
let loaderTimer = null;
let loaderProgress = 0;

// In-memory cache to avoid retrying the same missing image URLs
const failedImgCache = new Set();

function scheduleRender() {
  if (renderTimer) return; // already scheduled
  renderTimer = setTimeout(() => {
    renderTimer = null;
    render();
  }, RERENDER_DEBOUNCE_MS);
}

// Keep nav (#navHub) stuck directly beneath the sticky topbar by measuring its height
function updateStickyOffsets() {
  try {
    const root = document.documentElement;
    const tb = document.querySelector('.topbar');
    const h = tb ? Math.ceil(tb.getBoundingClientRect().height) : 56;
    root.style.setProperty('--topbar-h', h + 'px');
  } catch {}
}

function scheduleStickyMeasure() {
  if (stickyMeasureTimer) cancelAnimationFrame(stickyMeasureTimer);
  stickyMeasureTimer = requestAnimationFrame(updateStickyOffsets);
}

// Loading overlay helpers
function hideLoader() {
  if (loaderHidden) return;
  loaderHidden = true;
  const el = document.getElementById('loader');
  if (!el) return;
  // complete progress bar
  try { const f = document.getElementById('loaderFill'); if (f) f.style.width = '100%'; } catch {}
  if (loaderTimer) { clearInterval(loaderTimer); loaderTimer = null; }
  el.classList.add('hide');
  setTimeout(() => el && el.remove && el.remove(), 320);
}

function startLoaderProgress() {
  const fill = document.getElementById('loaderFill');
  if (!fill || loaderTimer) return;
  loaderProgress = 0;
  loaderTimer = setInterval(() => {
    // ease towards 80% while initializing
    const increment = 5 + Math.random() * 10;
    loaderProgress = Math.min(80, loaderProgress + increment);
    fill.style.width = loaderProgress + '%';
  }, 220);
}

function resetState() { setState(defaultState()); ensureModelTrends(); refreshAll(); saveState(); }

// One-time auto reset: if an old save exists right now, start a new game once
function maybeAutoResetOnExistingSave() {
  try {
    const hadSave = localStorage.getItem('ics_state');
    const already = localStorage.getItem('ics_reset_once');
    if (hadSave && already !== '1') {
      localStorage.setItem('ics_reset_once', '1');
      resetState();
    }
  } catch {}
}

// --- Leveling ---
function xpForLevel(level) {
  // Smooth curve: ~120, 180, 260, 360...
  return Math.round(100 + 20 * level + Math.pow(level, 1.6) * 20);
}
function xpNeeded() { return xpForLevel(state.level); }
function updateLevelUI() {
  const lvl = (typeof state.level === 'number' && isFinite(state.level)) ? state.level : 1;
  const xp = (typeof state.xp === 'number' && isFinite(state.xp)) ? state.xp : 0;
  const need = xpForLevel(lvl);
  const el = document.getElementById('level');
  if (el) el.textContent = `Lv ${lvl} — ${xp}/${need} XP`;
  // Also update the XP progress bar in the top bar if present
  const bar = document.getElementById('xpBar');
  const fill = document.getElementById('xpFill');
  const label = document.getElementById('xpLabel');
  if (fill) fill.style.width = Math.max(0, Math.min(100, Math.round((xp / Math.max(1, need)) * 100))) + '%';
  if (label) label.textContent = `Lv ${lvl} — ${xp}/${need} XP`;
}
function addXP(amount, reason = '') {
  if (!amount) return;
  state.xp = Math.max(0, Math.round(state.xp + amount));
  let leveled = false;
  while (state.xp >= xpNeeded()) {
    state.xp -= xpNeeded();
    state.level += 1;
    leveled = true;
  }
  if (reason) pushLog(`+${Math.round(amount)} XP — ${reason}`);
  if (leveled) pushLog(`Level up! Reached Level ${state.level}.`);
  updateLevelUI();
  saveState();
}
function marketSlots() {
  // Start 3, scale towards 7 with level
  return Math.min(7, 3 + Math.floor((state.level - 1) / 2));
}
// No model locks; condition disclosure narrows with level in Market

// --- Core Generators ---
function newCar(fromModel) {
  const parts = {};
  // Parts now have condition percentage (0-100)
  const wornBias = chance(0.6);
  for (const p of PARTS) {
    const cond = wornBias && chance(0.3) ? Math.round(rand(35, 75)) : Math.round(rand(70, 100));
    parts[p.key] = cond;
  }
  const avgCond = PARTS.reduce((a, p) => a + (parts[p.key] ?? 100), 0) / PARTS.length;
  const condFactor = 0.5 + (avgCond / 100) * 0.5; // 0.5..1.0
  const priceVar = rand(0.75, 1.25);
  const base = Math.round(fromModel.basePrice * getRate());
  const price = Math.round(base * priceVar * condFactor);
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    model: fromModel.model,
    basePrice: base,
    perf: fromModel.perf,
    price,
    priceHistory: [price],
    parts,
    boughtPrice: null,
  };
}

function startPartsTicker() {
  if (partsTicker) clearInterval(partsTicker);
  partsTicker = setInterval(() => {
    tickPartsPricesCore();
    if (currentView === 'parts' || currentView === 'garage') updatePartsPricesUI();
    saveState();
  }, PARTS_TICK_MS);
}

function maybeHeatEvent() {
  const h = state.heat || 0;
  if (h < 75) return;
  const p = Math.min(0.25, 0.05 + (h - 75) * 0.01);
  if (!chance(p)) return;
  if (chance(0.7)) {
    const fine = Math.max(250, Math.round(state.money * 0.07));
    if (state.money >= fine) addMoney(-fine, 'Police fine');
    pushLog('Police are watching. Lay low to reduce heat.');
    addHeat(-15, 'Cooling off');
  } else if (state.garage.length) {
    const idx = randi(0, state.garage.length);
    const car = state.garage[idx];
    state.garage.splice(idx, 1);
    pushLog(`Impound! Lost ${car.model}.`);
    addHeat(-20, 'Impound cooled heat');
    render();
  }
}

function startIllegalTicker() {
  if (illegalTicker) clearInterval(illegalTicker);
  illegalTicker = setInterval(() => {
    tickIllegalMarketCore();
    if ((state.heat || 0) >= 0) updateHeatUI();
    maybeHeatEvent();
    if (currentView === 'market') updateMarketPricesAndTrends();
    saveState();
  }, ILLEGAL_TICK_MS);
}

function startIllegalListingRefresher() {
  if (illegalRefreshTimer) clearInterval(illegalRefreshTimer);
  illegalRefreshTimer = setInterval(() => {
    refreshIllegalMarket();
    if (currentView === 'market') render();
    saveState();
  }, ILLEGAL_LISTING_REFRESH_MS);
}

// ensureModelTrends moved to economy.js

function modelId(name) {
  // slugify and trim leading/trailing dashes to avoid paths like "...-" causing 404s
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function advanceDay() {
  state.day += 1;
  refreshIllegalMarket();
  refreshPartsPrices();
  pushLog(`Day ${state.day}: markets refreshed.`);
  render();
  saveState();
}

// --- Money and Logs ---
function addMoney(amount, reason = '') {
  state.money = Math.max(0, Math.round(state.money + amount));
  if (reason) pushLog(`${amount >= 0 ? '+' : ''}${fmt.format(amount)} — ${reason}`);
  updateMoney();
  saveState();
}
function pushLog(msg) {
  state.log.unshift(msg);
  if (state.log.length > 60) state.log.pop();
  const el = document.getElementById('activityLog');
  if (el) renderLog(el);
  showToast(msg, 'info');
}

// --- Actions ---
function buyCar(idx) {
  const car = state.illegalMarket[idx];
  if (!car) return;
  if (state.garage.length >= garageCapacity()) {
    showToast('Garage is full. Buy a slot in Garage.', 'bad', [
      { label: 'Open Garage', action: () => setView('garage') }
    ]);
    return;
  }
  if (state.money < car.price) { showToast('Not enough cash to buy this car.', 'warn'); return; }
  addMoney(-car.price, `Bought ${car.model}`);
  addHeat(1, 'Shady purchase');
  car.boughtPrice = car.price;
  // Initialize valuation tracking for owned cars
  // Start from the price it was bought at so the trend begins at purchase
  car.valuation = car.boughtPrice;
  car.valuationHistory = [car.boughtPrice];
  state.garage.push(car);
  state.illegalMarket.splice(idx, 1);
  addXP(15, `Acquired ${car.model}`);
  render();
  saveState();
}

function sellCar(garageIndex) {
  const car = state.garage[garageIndex];
  if (!car) return;
  // Prefer live valuation if available
  const avgCond = PARTS.reduce((a, p) => a + (car.parts[p.key] ?? 100), 0) / PARTS.length;
  const condFactor = 0.5 + (avgCond / 100) * 0.5;
  const fallback = Math.round(car.basePrice * condFactor * rand(0.9, 1.1));
  const price = Math.round(car.valuation ?? fallback);
  showToast(`Sell ${car.model} for ${fmt.format(price)}?`, 'info', [
    { label: 'Cancel', action: () => {} },
    { label: 'Sell', action: () => finalizeSell(garageIndex, price) }
  ]);
}

function computeSellPrice(car) {
  const avgCond = PARTS.reduce((a, p) => a + (car.parts[p.key] ?? 100), 0) / PARTS.length;
  const condFactor = 0.5 + (avgCond / 100) * 0.5;
  const fallback = Math.round(car.basePrice * condFactor * rand(0.9, 1.1));
  return Math.round(car.valuation ?? fallback);
}

function finalizeSell(garageIndex, price) {
  const car = state.garage[garageIndex];
  if (!car) return;
  const amt = typeof price === 'number' ? price : computeSellPrice(car);
  addMoney(+amt, `Sold ${car.model}`);
  const profit = amt - (car.boughtPrice ?? amt);
  if (profit > 0) addXP(Math.round(10 + profit / 1000), `Sale profit on ${car.model}`);
  else addXP(5, `Sale experience`);
  state.garage.splice(garageIndex, 1);
  render();
  saveState();
}

function sellCarById(id) {
  const idx = state.garage.findIndex(c => c.id === id);
  if (idx >= 0) sellCar(idx);
}

// Inline, near-cursor double-click confirm on sell buttons
function ensureConfirmMap() {
  if (!state.ui) state.ui = { openCars: {}, showDev: false };
  if (!state.ui.confirmSell) state.ui.confirmSell = {};
}
function isSellConfirm(id) { return !!(state.ui && state.ui.confirmSell && state.ui.confirmSell[id]); }
function setSellConfirm(id, btn) {
  ensureConfirmMap();
  state.ui.confirmSell[id] = true;
  if (btn) {
    btn.textContent = 'Are you sure?';
    btn.classList.add('warn');
  }
  saveState();
  setTimeout(() => {
    if (state.ui && state.ui.confirmSell && state.ui.confirmSell[id]) {
      delete state.ui.confirmSell[id];
      saveState();
      if (btn && btn.isConnected) {
        btn.textContent = 'Sell';
        btn.classList.remove('warn');
      }
    }
  }, 2500);
}
function clearSellConfirm(id, btn) {
  if (state.ui && state.ui.confirmSell && state.ui.confirmSell[id]) {
    delete state.ui.confirmSell[id];
    if (btn && btn.isConnected) {
      btn.textContent = 'Sell';
      btn.classList.remove('warn');
    }
  }
}
function onSellClick(garageIndex, id, btn) {
  if (!isSellConfirm(id)) {
    setSellConfirm(id, btn);
    return;
  }
  clearSellConfirm(id, btn);
  finalizeSell(garageIndex);
}
function onSellClickById(id, btn) {
  const idx = state.garage.findIndex(c => c.id === id);
  if (idx === -1) return;
  onSellClick(idx, id, btn);
}

function avgCondition(car) { return PARTS.reduce((a, p) => a + (car.parts[p.key] ?? 100), 0) / PARTS.length; }
function conditionStatus(avg) {
  if (avg >= 80) return { label: 'Good', cls: 'ok' };
  if (avg >= 60) return { label: 'Worn', cls: 'info' };
  if (avg >= 40) return { label: 'Risky', cls: 'bad' };
  return { label: 'Critical', cls: 'bad' };
}
// canRace and simulateRaceOutcome moved to ./js/race.js

function applyRaceOutcome(car, outcome, bet) {
  if (outcome.failedPart) {
    const key = outcome.failedPart;
    const cond = car.parts[key] ?? 100;
    const drop = Math.round(rand(15, 35));
    car.parts[key] = clamp(cond - drop, 0, 100);
    car.failed = true;
    pushLog(`${car.model} DNF — ${PARTS.find(p=>p.key===key).name} failed during the race! Vehicle must be repaired before racing again.`);
    if (bet && bet > 0) addMoney(-bet, 'Race bet lost (DNF)');
    return;
  }
  if (outcome.win) {
    if (bet && bet > 0) {
      const profit = Math.round(bet * outcome.netProfitMult);
      addMoney(profit, 'Race bet won');
    }
    addXP(Math.round(12 + car.perf / 10), `${car.model} race win`);
    addHeat(3, 'Street race');
  } else {
    pushLog(`${car.model} lost the race. No payout.`);
    if (bet && bet > 0) addMoney(-bet, 'Race bet lost');
    addXP(4, `${car.model} race experience`);
    addHeat(2, 'Street race');
  }
  const wearPart = sample(PARTS).key;
  car.parts[wearPart] = clamp((car.parts[wearPart] ?? 100) - Math.round(rand(5, 12)), 0, 100);
}

function showRaceAnimation(car, outcome, done) {
  const modal = document.createElement('div');
  modal.className = 'race-modal open';
  modal.id = 'raceModal';
  const backdrop = document.createElement('div'); backdrop.className = 'race-backdrop'; backdrop.onclick = () => {};
  const panel = document.createElement('div'); panel.className = 'race-panel';
  // pick a simple opponent for the animation label
  const opp = sample(MODELS);
  const title = document.createElement('div'); title.className = 'race-title'; title.textContent = `Racing: ${car.model} vs ${opp.model}`;
  const track = document.createElement('div'); track.className = 'race-track';
  const inner = document.createElement('div'); inner.className = 'race-track-inner'; track.appendChild(inner);
  const carEl = document.createElement('div'); carEl.className = 'race-car'; carEl.textContent = '🚗'; track.appendChild(carEl);
  const oppEl = document.createElement('div'); oppEl.className = 'race-car opponent'; oppEl.textContent = '🚙'; track.appendChild(oppEl);
  const flag = document.createElement('div'); flag.className = 'race-flag'; flag.textContent = '🏁'; track.appendChild(flag);
  const result = document.createElement('div'); result.className = 'race-result'; result.textContent = '';
  // legend + actions
  const legend = document.createElement('div'); legend.className = 'race-legend';
  legend.innerHTML = `<span class="tag">You (red 🚗): ${car.model}</span> <span class="tag">Rival (blue 🚙): ${opp.model}</span>`;
  const actions = document.createElement('div'); actions.className = 'race-actions';
  // Bet slider
  const maxBet = Math.max(0, Math.min(Math.floor(state.money * 0.25), 50000));
  const minBet = Math.min(1000, maxBet);
  const betWrap = document.createElement('div'); betWrap.className = 'options-field';
  const betLabel = document.createElement('strong'); betLabel.textContent = 'Bet:'; betWrap.appendChild(betLabel);
  const betVal = document.createElement('span'); betVal.textContent = fmt.format(minBet || 0); betWrap.appendChild(betVal);
  const betInput = document.createElement('input'); betInput.type = 'range'; betInput.min = (maxBet > 0 ? String(Math.max(0, minBet)) : '0'); betInput.max = String(maxBet); betInput.step = '100'; betInput.value = (maxBet > 0 ? String(Math.max(0, minBet)) : '0');
  betInput.oninput = () => { betVal.textContent = fmt.format(parseInt(betInput.value||'0',10)); };
  betWrap.appendChild(betInput);
  panel.appendChild(betWrap);
  const startBtn = document.createElement('button'); startBtn.className = 'btn good'; startBtn.textContent = 'Start Race';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn'; cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => { modal.remove(); };
  actions.appendChild(startBtn); actions.appendChild(cancelBtn);
  panel.appendChild(title); panel.appendChild(legend); panel.appendChild(track); panel.appendChild(actions); panel.appendChild(result);
  modal.appendChild(backdrop); modal.appendChild(panel);
  document.body.appendChild(modal);
  // Configure endpoints based on outcome (player leads slightly on win)
  if (outcome.failedPart) {
    carEl.style.setProperty('--end', 'calc(100% - 80px)');
    oppEl.style.setProperty('--end', 'calc(100% - 44px)');
  } else if (outcome.win) {
    carEl.style.setProperty('--end', 'calc(100% - 44px)');
    oppEl.style.setProperty('--end', 'calc(100% - 64px)');
  } else {
    carEl.style.setProperty('--end', 'calc(100% - 64px)');
    oppEl.style.setProperty('--end', 'calc(100% - 44px)');
  }
  carEl.style.setProperty('--dur', '2.2s');
  oppEl.style.setProperty('--dur', '2.2s');
  // Start handler to launch animation
  startBtn.onclick = () => {
    startBtn.disabled = true;
    const bet = parseInt(betInput.value || '0', 10) || 0;
    if (bet > state.money) { showToast('Not enough cash for this bet.', 'warn'); startBtn.disabled = false; return; }
    carEl.classList.add('run');
    oppEl.classList.add('run');
    setTimeout(() => {
      if (outcome.failedPart) { result.textContent = 'DNF — part failed!'; result.style.color = '#ff9e9e'; }
      else if (outcome.win) { result.textContent = 'Victory!'; result.style.color = '#c9f7cf'; }
      else { result.textContent = 'Defeat'; result.style.color = '#cfe8ff'; }
    }, 1400);
    setTimeout(() => {
      modal.classList.remove('open');
      modal.remove();
      done && done(bet);
    }, 2200);
  };
}

function raceCar(garageIndex) {
  const car = state.garage[garageIndex];
  if (!car) return;
  if (!canRace(car)) { showToast('Vehicle must be repaired before racing.', 'warn'); return; }
  // Simulate using opponent perf chosen in animation as proxy (pass later into simulate, but we already simulate here)
  const outcome = simulateRaceOutcome(car, undefined);
  showRaceAnimation(car, outcome, (bet) => {
    applyRaceOutcome(car, outcome, bet || 0);
    render();
    saveState();
  });
}

function repairCar(garageIndex, partKey, source) {
  const car = state.garage[garageIndex];
  if (!car) return;
  const price = state.partsPrices[source][partKey];
  if (state.money < price) { showToast('Not enough cash for this repair.', 'warn'); return; }
  const before = car.parts[partKey] ?? 100;
  addMoney(-price, `Serviced ${partKey} on ${car.model} (${source})`);
  if (source === 'legal') {
    car.parts[partKey] = 100; // full restore
  } else {
    // Illegal: cheaper but variable quality and possible botch (improves with level)
    const botchChance = clamp(0.1 - 0.01 * (state.level - 1), 0.03, 0.1);
    if (chance(botchChance)) {
      car.parts[partKey] = Math.round(rand(20, 50));
      pushLog(`Shoddy illegal ${partKey} install on ${car.model}.`);
    } else {
      const target = Math.round(rand(Math.max(before, 60), 95));
      car.parts[partKey] = target;
    }
    addHeat(2, 'Illegal parts');
  }
  // Re-center valuation bounds after condition change
  if (typeof car.valuation === 'number') {
    const avg = avgCondition(car);
    const condFactor = 0.5 + (avg / 100) * 0.5;
    const min = Math.round(car.basePrice * condFactor * 0.7);
    const max = Math.round(car.basePrice * condFactor * 1.3);
    car.valuation = clamp(Math.round(car.valuation), min, max);
    if (Array.isArray(car.valuationHistory)) {
      car.valuationHistory.push(car.valuation);
      if (car.valuationHistory.length > PRICE_HISTORY_MAX) car.valuationHistory.shift();
    }
  }
  // Clear failure state if car is healthy enough after repair
  if (car.failed) {
    const healthy = PARTS.every(p => (car.parts[p.key] ?? 100) >= 60);
    if (healthy) car.failed = false;
  }
  addXP(source === 'legal' ? 4 : 6, `Serviced ${partKey}`);
  render();
  saveState();
}

// --- Rendering ---
const NAV = [
  { key: 'market', label: 'Illegal Market', icon: 'cart' },
  { key: 'garage', label: 'Garage', icon: 'garage' },
  { key: 'races', label: 'Races', icon: 'flag' },
  { key: 'casino', label: 'Casino', icon: 'casino' },
];
let currentView = 'market';

function setView(key) { currentView = key; render(); }

function updateMoney() {
  const el = document.getElementById('money');
  if (el) el.textContent = fmt.format(state.money);
  updateLevelUI();
  const slots = document.getElementById('slotsTag');
  if (slots) slots.textContent = `${(state.garage||[]).length}/${garageCapacity()} Slots`;
  updateHeatUI();
}

function updateHeatUI() {
  const chip = document.getElementById('heat');
  const fill = document.getElementById('heatFill');
  const label = document.getElementById('heatLabel');
  if (!chip || !fill || !label) return;
  const h = Math.max(0, Math.min(100, Math.round(state.heat || 0)));
  fill.style.width = h + '%';
  label.textContent = `Heat ${h}%`;
  chip.classList.remove('low','med','high');
  if (h < 40) chip.classList.add('low'); else if (h < 75) chip.classList.add('med'); else chip.classList.add('high');
}

function addHeat(amount, reason = '') {
  const prev = state.heat || 0;
  state.heat = Math.max(0, Math.min(100, Math.round(prev + amount)));
  if (reason) pushLog(`${amount >= 0 ? '+' : ''}${Math.round(amount)} Heat — ${reason}`);
  updateHeatUI();
  saveState();
}

function renderNav() {
  renderNavUI({
    state,
    currentView,
    navItems: NAV,
    onSetView: (key) => setView(key),
    onToggleOptions: () => toggleOptionsMenu(),
    onHideOptions: () => hideOptionsMenu(),
    onToggleDev: () => toggleDevPanel(),
    onNewGame: () => showToast('Start a new game?', 'info', [
      { label: 'Cancel', action: () => {} },
      { label: 'Confirm', action: () => resetState() }
    ]),
    currencyCode: state.currency || 'USD',
    currencies: [['USD','US Dollar'], ['GBP','British Pound'], ['EUR','Euro'], ['JPY','Japanese Yen'], ['PLN','Polish Złoty']],
    onSetCurrency: (code) => setCurrency(code),
    onGoHome: () => { try { window.location.href = '../index.html'; } catch {} },
    onSetSound: (enabled) => { ensureCasinoUI(); state.ui.casino.sound = !!enabled; saveState(); if (enabled) { casinoEnsureAudio(); casinoApplyVolume(); } },
    onSetVolume: (vol) => { ensureCasinoUI(); state.ui.casino.volume = Math.max(0, Math.min(1, vol)); casinoApplyVolume(); saveState(); },
    onTestSound: () => { ensureCasinoUI(); casinoEnsureAudio(); casinoPlayTest(); },
  });
  // Render center nav back in its original place
  renderCenterNavUI({ state, currentView, navItems: NAV, onSetView: (key) => setView(key) });
  // Recalculate sticky offsets after nav and topbar updates
  scheduleStickyMeasure();
}

function toggleOptionsMenu() {
  if (!state.ui) state.ui = { openCars: {}, showDev: false };
  state.ui.showOptions = !state.ui.showOptions;
  const pop = document.getElementById('optionsPop');
  if (pop) pop.classList.toggle('open', !!state.ui.showOptions);
  saveState();
}
function hideOptionsMenu() {
  if (state.ui) state.ui.showOptions = false;
  const pop = document.getElementById('optionsPop');
  if (pop) pop.classList.remove('open');
}

// (Removed duplicate renderNav definition)

function isCarOpen(id) { return !!(state.ui && state.ui.openCars && state.ui.openCars[id]); }
function toggleCarOpen(id) {
  if (!state.ui) state.ui = { openCars: {} };
  if (!state.ui.openCars) state.ui.openCars = {};
  state.ui.openCars[id] = !state.ui.openCars[id];
  render();
  saveState();
}

function toggleDevPanel() {
  if (!state.ui) state.ui = { openCars: {}, showDev: false };
  state.ui.showDev = !state.ui.showDev;
  renderDevPanel();
  saveState();
}

function cheatMoney(amount) {
  addMoney(amount, 'Dev: money');
}
function cheatLevels(n) {
  state.level = Math.max(1, (state.level || 1) + n);
  pushLog(`Dev: level set to ${state.level}`);
  updateLevelUI();
  saveState();
  render();
}

function devAddFreeSpins(n) {
  ensureCasinoUI();
  if (n === 'clear') {
    state.ui.casino.freeSpins = 0;
    showToast('Dev: free spins cleared', 'info');
  } else {
    const amt = typeof n === 'number' ? n : 0;
    state.ui.casino.freeSpins = (state.ui.casino.freeSpins || 0) + amt;
    showToast(`Dev: +${amt} free spins`, 'good');
  }
  saveState();
  renderFreeSpins();
}

function renderDevPanel() {
  let panel = document.getElementById('devPanel');
  if (!state.ui || !state.ui.showDev) {
    if (panel) panel.remove();
    return;
  }
  ensureDevUI();
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'devPanel';
    panel.className = 'dev-panel';
    document.body.appendChild(panel);
  }
  panel.innerHTML = '';
  panel.appendChild(el('h4', { text: 'Dev Cheats' }));

  const addSection = (key, title, icon, rows) => {
    const open = isDevSectionOpen(key);
    const wrap = document.createElement('div');
    wrap.className = 'collapsible' + (open ? ' open' : '');
    const header = el('div', { class: 'row' }, [
      el('button', { class: 'toggle dev-toggle' + (open ? ' active' : ''), text: `${icon}  ${title}`, onclick: () => { toggleDevSection(key); renderDevPanel(); } }),
    ]);
    const content = document.createElement('div');
    content.className = 'content dev-content';
    rows.forEach(r => content.appendChild(el('div', { class: 'row' }, r)));
    wrap.appendChild(header);
    wrap.appendChild(content);
    panel.appendChild(wrap);
  };

  addSection('eco', 'Economy', '💵', [
    [ el('button', { class: 'btn', text: '+$10,000', onclick: () => cheatMoney(10000) }),
      el('button', { class: 'btn', text: '+$100,000', onclick: () => cheatMoney(100000) }) ],
  ]);

  addSection('prog', 'Progression', '📈', [
    [ el('button', { class: 'btn', text: '+1 Level', onclick: () => cheatLevels(1) }),
      el('button', { class: 'btn', text: '+5 Levels', onclick: () => cheatLevels(5) }) ],
  ]);

  addSection('heat', 'Heat', '🔥', [
    [ el('button', { class: 'btn warn', text: '+10 Heat', onclick: () => addHeat(10, 'Dev heat') }),
      el('button', { class: 'btn', text: 'Clear Heat', onclick: () => addHeat(-100, 'Dev clear') }) ],
  ]);

  addSection('casino', 'Casino', '🎰', [
    [ el('button', { class: 'btn good', text: '+5 Free Spins', onclick: () => devAddFreeSpins(5) }),
      el('button', { class: 'btn good', text: '+50 Free Spins', onclick: () => devAddFreeSpins(50) }),
      el('button', { class: 'btn warn', text: 'Clear Free Spins', onclick: () => devAddFreeSpins('clear') }) ],
  ]);
}

function ensureDevUI() {
  if (!state.ui) state.ui = {};
  if (!state.ui.dev) state.ui.dev = { sections: { eco: true, prog: true, heat: false, casino: true } };
  if (!state.ui.dev.sections) state.ui.dev.sections = { eco: true, prog: true, heat: false, casino: true };
}
function isDevSectionOpen(key) { ensureDevUI(); return !!state.ui.dev.sections[key]; }
function toggleDevSection(key) { ensureDevUI(); state.ui.dev.sections[key] = !state.ui.dev.sections[key]; saveState(); }

function openImagePicker(model) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (!state.assets) state.assets = { modelImages: {} };
      if (!state.assets.modelImages) state.assets.modelImages = {};
      state.assets.modelImages[model] = String(reader.result);
      saveState();
      render();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// getBodyStyle and getSilhouettePath provided by ui.js

function renderMarketCondition(avg, level) {
  const L = Math.max(1, level || 1);
  const showExactAt = 7; // from Lv7+ show exact
  if (L >= showExactAt) {
    const cls = avg >= 70 ? 'ok' : avg >= 50 ? 'info' : 'bad';
    return el('span', { class: `tag ${cls}` , text: `Avg ${avg}%` });
  }
  // Uncertainty range narrows with level
  const baseWidth = 40; // percent points at Lv1
  const step = 5;       // narrows 5pp per level
  const width = Math.max(8, baseWidth - (L - 1) * step);
  const low = Math.max(0, Math.min(100, Math.round(avg - width / 2)));
  const high = Math.max(0, Math.min(100, Math.round(avg + width / 2)));
  const mid = Math.round((low + high) / 2);
  const cls = mid >= 70 ? 'ok' : mid >= 50 ? 'info' : 'bad';
  return el('span', { class: `tag ${cls}`, text: `Est ${low}–${high}%` });
}

// getIconSVG and el moved to ui.js

function renderLog(container) {
  container.innerHTML = '';
  for (const msg of state.log) {
    const line = document.createElement('div');
    line.textContent = '• ' + msg;
    container.appendChild(line);
  }
}

// Dashboard removed; topbar now shows status, and notifications display side toasts

function renderMarket() {
  const view = document.getElementById('view');
  view.innerHTML = '';
  if (!state.illegalMarket.length) { refreshIllegalMarket(); saveState(); }
  const panel = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Illegal Market — Cars' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: 'Live' }),
    ]),
    el('div', {}, [
      el('table', {}, [
        el('thead', {}, [ el('tr', {}, [
          el('th', { text: 'Model' }),
          el('th', { text: 'Perf' }),
          el('th', { text: 'Condition' }),
          el('th', { text: 'Price' }),
          el('th', { text: '' }),
        ]) ]),
        el('tbody', {}, state.illegalMarket.map((car, idx) => {
          const avg = Math.round(PARTS.reduce((a, p) => a + (car.parts[p.key] ?? 100), 0) / PARTS.length);
          const condNode = renderMarketCondition(avg, state.level);
          return el('tr', {}, [
            el('td', { text: car.model }),
            el('td', { text: String(car.perf) }),
            el('td', {}, [condNode]),
            el('td', {}, [ el('span', { ['data-car-price']: car.id, text: fmt.format(car.price) }) ]),
            el('td', {}, [ el('button', { class: 'btn good', onclick: () => buyCar(idx), text: 'Buy' }) ]),
          ]);
        }))
      ])
    ])
  ]);
  view.appendChild(panel);

  // Trends section under the listings
  const trends = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Price Trends' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'subtle', text: 'Auto-updating' }),
    ]),
    el('div', { class: 'grid' }, state.illegalMarket.map((car) => {
      const card = el('div', { class: 'panel' }, [
        el('div', { class: 'row' }, [
          el('strong', { text: car.model }),
          el('div', { class: 'spacer' }),
          el('span', { class: 'tag info', ['data-car-tprice']: car.id, text: fmt.format(car.price) }),
        ]),
        (() => {
          const c = document.createElement('canvas');
          c.width = 320; c.height = 80;
          c.style.width = '100%'; c.style.height = '80px';
          c.setAttribute('data-car-spark', car.id);
          setTimeout(() => drawSparkline(c, car.priceHistory || [car.price], '#57b6ff'), 0);
          return c;
        })(),
      ]);
      return card;
    }))
  ]);
  view.appendChild(trends);

  // Owned cars price trends
  if (state.garage.length) {
    const owned = el('div', { class: 'panel' }, [
      el('div', { class: 'row' }, [
        el('h3', { text: 'Your Cars — Price Trends' }),
        el('div', { class: 'spacer' }),
        el('span', { class: 'subtle', text: 'Auto-updating' }),
      ]),
      el('div', { class: 'grid' }, state.garage.map((car) => {
        const card = el('div', { class: 'panel' }, [
          el('div', { class: 'row' }, [
            el('strong', { text: car.model }),
            el('div', { class: 'spacer' }),
            el('span', { class: 'tag ok', ['data-own-tprice']: car.id, text: fmt.format(car.valuation ?? 0) }),
            (() => {
              const profit = (car.valuation ?? 0) - (car.boughtPrice ?? 0);
              const cls = profit >= 0 ? 'tag ok' : 'tag bad';
              return el('span', { class: cls, ['data-own-pl']: car.id, text: `${profit >= 0 ? '+' : ''}${fmt.format(profit)}` });
            })(),
          ]),
          (() => {
            const c = document.createElement('canvas');
            c.width = 320; c.height = 80;
            c.style.width = '100%'; c.style.height = '80px';
            c.setAttribute('data-own-spark', car.id);
            const pts = (car.valuationHistory && car.valuationHistory.length) ? car.valuationHistory : [(car.valuation ?? 0)];
            setTimeout(() => drawSparkline(c, pts, '#7ee787'), 0);
            return c;
          })(),
          el('div', { class: 'row' }, [
            (() => { const b = el('button', { class: 'btn danger', text: isSellConfirm(car.id) ? 'Are you sure?' : 'Sell Now' }); b.onclick = () => onSellClickById(car.id, b); return b; })(),
          ]),
        ]);
        return card;
      }))
    ]);
    view.appendChild(owned);
  }

  // All cars trends with pinned current listings first
  const pinnedOrder = [];
  for (const car of state.illegalMarket) if (!pinnedOrder.includes(car.model)) pinnedOrder.push(car.model);
  const allModels = MODELS.map(m => m.model).filter(m => !pinnedOrder.includes(m));
  const ordered = pinnedOrder.concat(allModels);
  ensureModelTrends();
  const allPanel = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'All Cars — Trends' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'subtle', text: 'Pinned: In Shop' }),
    ]),
    el('div', { class: 'grid' }, ordered.map((name) => {
      const mid = modelId(name);
      const m = MODELS.find(mm => mm.model === name);
      const points = state.modelTrends[name] || [m ? m.basePrice : 0];
      const curVal = points[points.length - 1] || (m ? m.basePrice : 0);
      const pinned = pinnedOrder.includes(name);
      const card = el('div', { class: 'panel' }, [
        el('div', { class: 'row' }, [
          el('strong', { text: name }),
          el('div', { class: 'spacer' }),
          pinned ? el('span', { class: 'tag ok', text: 'In Shop' }) : el('span', { class: 'tag', text: 'Index' }),
          el('span', { class: 'tag info', ['data-model-price']: mid, text: fmt.format(curVal) }),
        ]),
        (() => {
          const c = document.createElement('canvas');
          c.width = 320; c.height = 80;
          c.style.width = '100%'; c.style.height = '80px';
          c.setAttribute('data-model-spark', mid);
          setTimeout(() => drawSparkline(c, points, '#9aa4ff'), 0);
          return c;
        })(),
      ]);
      return card;
    }))
  ]);
  view.appendChild(allPanel);
}

function refreshMarketAndRender() { refreshIllegalMarket(); render(); saveState(); }

// --- Mini chart renderer ---
// drawSparkline moved to ui.js

// --- In-place UI updates (no layout bounce) ---
function updateMarketPricesAndTrends() { updateMarketPricesAndTrendsUI({ state, MODELS, fmt, modelId }); }

function updatePartsPricesUI() { updatePartsPricesUI_M({ state, PARTS, fmt }); }

function renderGarage() {
  const view = document.getElementById('view');
  view.innerHTML = '';
  // Storage management panel
  const capUsed = state.garage.length;
  const capMax = garageCapacity();
  const costNext = nextGarageCost();
  const capPanel = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Storage' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: `${capUsed}/${capMax} slots used` }),
      el('span', { class: 'hidden', text: '' })
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn primary', text: `Buy Slot (${fmt.format(costNext)})`, onclick: () => buyGarageSlot(), disabled: false }),
    ]),
  ]);
  view.appendChild(capPanel);
  if (!state.garage.length) {
    const empty = el('div', { class: 'panel notice', text: 'No cars yet. Buy from the Illegal Market.' });
    view.appendChild(empty); return;
  }
  for (const [idx, car] of state.garage.entries()) {
    const avg = Math.round(avgCondition(car));
    const st = conditionStatus(avg);
    const header = el('div', { class: 'row' }, [
      el('h3', { text: `${car.model} ` }),
      el('span', { class: `tag ${st.cls}`, text: st.label + ` (${avg}%)` }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: `Perf ${car.perf}` }),
      (() => { const b = el('button', { class: 'toggle', text: isCarOpen(car.id) ? 'Hide Details ▴' : 'Show Details ▾' }); b.onclick = () => toggleCarOpen(car.id); return b; })(),
    ]);

    const breakdown = renderCarBreakdown(car, idx);
    const collapsible = el('div', { class: 'collapsible ' + (isCarOpen(car.id) ? 'open' : '') }, [
      el('div', { class: 'content' }, [breakdown])
    ]);

    // Build Sell button with stable element reference for in-place label swap
    const sellBtn = el('button', { class: 'btn danger', text: isSellConfirm(car.id) ? 'Are you sure?' : 'Sell' });
    sellBtn.onclick = () => onSellClick(idx, car.id, sellBtn);
    const raceBtn = el('button', { class: 'btn good', text: 'Race', onclick: () => raceCar(idx) });
    const upBtn = el('button', { class: 'btn', text: 'Upload Photo', onclick: () => openImagePicker(car.model) });
    const actions = el('div', { class: 'row' }, [ sellBtn, raceBtn, upBtn ]);

    const card = el('div', { class: 'panel' }, [ header, collapsible, actions ]);
    view.appendChild(card);
  }
}

function renderCarBreakdown(car, idx) {
  const box = el('div', { class: 'car-breakdown' });
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 600 260');
  svg.setAttribute('class', 'car-silhouette');
  const group = document.createElementNS(svgNS, 'g');
  group.setAttribute('class', 'car-group');
  group.setAttribute('transform', 'translate(60,18) scale(0.78)');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('class', 'silhouette-path');
  // car outline path by body style
  const body = getBodyStyle(car.model);
  path.setAttribute('d', getSilhouettePath(body));
  // optional background image: uploaded per-model OR bundled asset by slug
  let imgSrc = state.assets && state.assets.modelImages && state.assets.modelImages[car.model];
  const slug = modelId(car.model);
  const styleSlug = '_' + getBodyStyle(car.model);
  // Prefer known bundled silhouettes first to avoid noisy 404s
  const candidates = [
    imgSrc, // uploaded per-model image if any
    `Assets/Cars/${styleSlug}.svg`,
    `assets/cars/${styleSlug}.svg`,
    `Assets/Cars/${slug}.svg`,
    `assets/cars/${slug}.svg`,
  ].filter(Boolean);
  if (candidates.length) {
    const img = document.createElement('img');
    // pick first candidate not known to fail
    let i = 0;
    while (i < candidates.length && failedImgCache.has(candidates[i])) i += 1;
    img.src = candidates[i] || candidates[0];
    img.alt = car.model;
    img.className = 'car-photo';
    img.onerror = () => {
      failedImgCache.add(img.src);
      // advance to next non-failed candidate
      do { i += 1; } while (i < candidates.length && failedImgCache.has(candidates[i]));
      if (i < candidates.length) img.src = candidates[i];
      else if (img && img.parentNode) img.parentNode.removeChild(img);
    };
    box.appendChild(img);
  }
  group.appendChild(path);
  svg.appendChild(group);
  // connectors to callouts (formatted: left large, top center, right large)
  const connectors = [
    // Left (engine group) from front axle and hood
    { points: '170,190 140,215 120,240' },
    { points: '150,120 130,100 120,80' },
    // Top center (drivetrain) from roofline
    { points: '360,120 360,90 360,60' },
    // Right (running gear) from rear axle and underbody
    { points: '460,190 510,220 560,240' },
    { points: '380,205 500,235 560,240' },
  ];
  for (const c of connectors) {
    const pl = document.createElementNS(svgNS, 'polyline');
    pl.setAttribute('class', 'connector');
    pl.setAttribute('points', c.points);
    svg.appendChild(pl);
  }
  box.appendChild(svg);

  // Helper for badge class
  const badgeCls = (v) => v >= 70 ? 'ok' : v >= 50 ? 'info' : 'bad';

  // Callouts (grouped)
  const partPct = (key) => Math.round(car.parts[key] ?? 100);
  const addRow = (container, label, key, carId) => {
    const cond = partPct(key);
    const open = isPartActionsOpen(carId, key);
    const row = el('div', { class: 'row part' }, [
      el('span', { text: label }),
      el('div', { class: 'spacer' }),
      (() => { const t = el('span', { class: 'part-toggle' + (open ? ' active' : ''), title: 'Repair', text: '🔧' }); t.onclick = () => togglePartActions(carId, key, t); return t; })(),
      el('span', { class: `pct-badge ${badgeCls(cond)}`, text: `${cond}%` }),
    ]);
    container.appendChild(row);
    const actions = el('div', { class: 'part-actions', style: open && cond < 100 ? '' : 'display:none' }, [
      el('button', { class: 'btn sm', ['data-gprice']: 'legal', ['data-part']: key, text: `Legal ${fmt.format(state.partsPrices.legal[key])}`, onclick: () => repairCar(idx, key, 'legal') }),
      el('button', { class: 'btn warn sm', ['data-gprice']: 'illegal', ['data-part']: key, text: `Illegal ${fmt.format(state.partsPrices.illegal[key])}`, onclick: () => repairCar(idx, key, 'illegal') }),
    ]);
    // mark so toggle can find this actions block
    actions.setAttribute('data-actions-for', `${carId}:${key}`);
    container.appendChild(actions);
  };

  const engine = el('div', { class: 'callout', style: 'left:2%; top:12%;'}, [ el('div', { class: 'title' }, [ el('span', { text: 'Engine' }) ]) ]);
  addRow(engine, 'Engine Block', 'engine_block', car.id);
  addRow(engine, 'Induction', 'induction', car.id);
  addRow(engine, 'Fuel System', 'fuel_system', car.id);
  addRow(engine, 'Cooling', 'cooling', car.id);
  addRow(engine, 'Ignition', 'ignition', car.id);
  addRow(engine, 'Timing', 'timing', car.id);
  addRow(engine, 'Alternator', 'alternator', car.id);
  addRow(engine, 'ECU', 'ecu', car.id);
  box.appendChild(engine);

  const trans = el('div', { class: 'callout', style: 'left:50%; top:4%; transform: translateX(-50%);'}, [ el('div', { class: 'title' }, [ el('span', { text: 'Drivetrain' }) ]) ]);
  addRow(trans, 'Transmission', 'transmission', car.id);
  addRow(trans, 'Clutch', 'clutch', car.id);
  box.appendChild(trans);

  const running = el('div', { class: 'callout', style: 'right:2%; top:12%;'}, [ el('div', { class: 'title' }, [ el('span', { text: 'Running Gear' }) ]) ]);
  addRow(running, 'Tires', 'tires', car.id);
  addRow(running, 'Brakes', 'brakes', car.id);
  addRow(running, 'Suspension', 'suspension', car.id);
  addRow(running, 'Differential', 'differential', car.id);
  addRow(running, 'Exhaust', 'exhaust', car.id);
  addRow(running, 'Battery', 'battery', car.id);
  addRow(running, 'Interior Elec.', 'electronics', car.id);
  box.appendChild(running);

  // Ensure container height accommodates all callouts
  requestAnimationFrame(() => layoutCarBreakdown(box));
  return box;
}

// layoutCarBreakdown provided by ui.js

// Part actions toggle state
function ensureUIMaps() {
  if (!state.ui) state.ui = { openCars: {}, showDev: false };
  if (!state.ui.openPartActions) state.ui.openPartActions = {};
}
function isPartActionsOpen(carId, key) {
  ensureUIMaps();
  const m = state.ui.openPartActions[carId];
  return m ? !!m[key] : false;
}
function togglePartActions(carId, key, toggleEl) {
  ensureUIMaps();
  const m = state.ui.openPartActions[carId] || (state.ui.openPartActions[carId] = {});
  m[key] = !m[key];
  // Update arrow
  if (toggleEl) toggleEl.classList.toggle('active', m[key]);
  // Show/hide actions block without full re-render
  const actions = document.querySelector(`.part-actions[data-actions-for="${carId}:${key}"]`);
  if (actions) {
    actions.style.display = m[key] ? '' : 'none';
    const container = actions.closest('.car-breakdown');
    if (container) layoutCarBreakdown(container);
  }
  saveState();
}

function renderParts() {
  const view = document.getElementById('view');
  view.innerHTML = '';
  const panel = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Parts Market' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: 'Live' }),
    ]),
    el('table', {}, [
      el('thead', {}, [ el('tr', {}, [
        el('th', { text: 'Part' }),
        el('th', { text: 'Legal Price' }),
        el('th', { text: 'Illegal Price' }),
      ])]),
      el('tbody', {}, PARTS.map(p => el('tr', {}, [
        el('td', { text: p.name }),
        el('td', {}, [ el('span', { ['data-part-legal']: p.key, text: fmt.format(state.partsPrices.legal[p.key]) }) ]),
        el('td', {}, [ el('span', { ['data-part-illegal']: p.key, text: fmt.format(state.partsPrices.illegal[p.key]) }) ]),
      ])))
    ]),
    el('div', { class: 'notice', text: 'Prices update automatically. Illegal parts are cheaper but can fail on install.' })
  ]);
  view.appendChild(panel);
}

function renderRaces() {
  const view = document.getElementById('view');
  view.innerHTML = '';
  if (!state.garage.length) {
    view.appendChild(el('div', { class: 'panel notice', text: 'No cars to race. Buy one first.' }));
    return;
  }
  const panel = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [ el('h3', { text: 'Organize Street Race' }), el('div', { class: 'spacer' }) ]),
    el('table', {}, [
      el('thead', {}, [ el('tr', {}, [
        el('th', { text: 'Car' }),
        el('th', { text: 'Perf' }),
        el('th', { text: 'Condition' }),
        el('th', { text: '' }),
      ])]),
      el('tbody', {}, state.garage.map((car, idx) => {
        const avg = Math.round(avgCondition(car));
        const st = conditionStatus(avg);
        const condTag = car.failed ? el('span', { class: 'tag bad', text: 'Failed' }) : el('span', { class: `tag ${st.cls}`, text: `${st.label} (${avg}%)` });
        const broken = PARTS.find(p => (car.parts[p.key] ?? 100) < 60);
        const condCell = broken
          ? [ condTag, el('div', { class: 'subtle', text: `Needs replacing: ${broken.name}` }) ]
          : [ condTag ];
        return el('tr', {}, [
          el('td', { text: car.model }),
          el('td', { text: String(car.perf) }),
          el('td', {}, condCell),
          el('td', {}, [ el('button', { class: 'btn good', text: 'Race', onclick: () => raceCar(idx), disabled: !canRace(car) }) ]),
        ]);
      }))
    ])
  ]);
  view.appendChild(panel);
}

function render() {
  renderNav();
  // Old secondary nav hub removed; using topnav only
  updateMoney();
  // Wire top-right options cog opens modal
  const optionsCog = document.getElementById('optionsCog');
  if (optionsCog) optionsCog.onclick = () => showOptionsModal();
  const view = document.getElementById('view');
  if (!view) return;
  if (currentView === 'market') {
    if (!state.illegalMarket.length) { refreshIllegalMarket(); saveState(); }
    renderMarketView({ state, PARTS, MODELS, fmt, modelId, ensureModelTrends, onBuyCar: (idx) => buyCar(idx) });
  } else if (currentView === 'garage') {
    renderGarageFullView({
      state, PARTS, fmt, modelId,
      avgCondition,
      conditionStatus,
      isCarOpen,
      onToggleCarOpen: (id) => toggleCarOpen(id),
      isSellConfirm,
      onSellClickById: (id, btn) => onSellClickById(id, btn),
      onRaceCar: (idx) => raceCar(idx),
      onOpenImagePicker: (m) => openImagePicker(m),
      onRepairCar: (idx, key, source) => repairCar(idx, key, source),
      garageCapacity,
      nextGarageCost,
      onBuyGarageSlot: () => buyGarageSlot(),
      saveState: () => saveState(),
    });
  } else if (currentView === 'races') {
    renderRacesView({ state, PARTS, avgCondition, conditionStatus, canRace, onRaceCar: (idx) => raceCar(idx) });
  } else if (currentView === 'casino') {
    renderCasino();
  }
  // options now displayed as a modal, not a separate view
  ensureToasts();
  // relayout breakdowns on each render
  requestAnimationFrame(() => {
    document.querySelectorAll('.car-breakdown').forEach(layoutCarBreakdown);
  });
}

// --- Casino: Slots (Vegas 3x3, multi-line) ---
const SLOTS_SYMBOLS = [
  { s: '🍒', w: 8, p3: 5, p2: 1.5 },
  { s: '🍋', w: 8, p3: 4, p2: 1.4 },
  { s: '🔔', w: 5, p3: 8, p2: 2.0 },
  { s: '⭐️', w: 4, p3: 12, p2: 3.0 },
  { s: '💎', w: 3, p3: 20, p2: 4.0 },
  { s: '7️⃣', w: 1, p3: 40, p2: 6.0 },
  // Wild substitutes on paylines; 3+ wilds anywhere award free spins
  { s: '🃏', w: 2, p3: 25, p2: 5.0, wild: true },
];
const SLOTS_WEIGHTS = (() => { const arr=[]; SLOTS_SYMBOLS.forEach(sym => { for(let i=0;i<sym.w;i++) arr.push(sym); }); return arr; })();
const PAYLINES = [
  [0,0,0], // top
  [1,1,1], // middle
  [2,2,2], // bottom
  [0,1,2], // diag down
  [2,1,0], // diag up
  [0,1,0], // V top
  [2,1,2], // V bottom
];
function slotsPick() { return SLOTS_WEIGHTS[randi(0, SLOTS_WEIGHTS.length)].s; }
function slotsGrid() { const g = []; for(let r=0;r<3;r++){ g[r]=[]; for(let c=0;c<3;c++){ g[r][c]=slotsPick(); } } return g; }
const isWild = (s) => s === '🃏';
function linePayout(grid, line, betPerLine) {
  const a = grid[line[0]][0], b = grid[line[1]][1], c = grid[line[2]][2];
  // Determine triple with wild substitution
  // Target symbol is the first non-wild encountered; if none, wild itself
  const firstNonWild = !isWild(a) ? a : (!isWild(b) ? b : (!isWild(c) ? c : '🃏'));
  const aMatch = isWild(a) || a === firstNonWild;
  const bMatch = isWild(b) || b === firstNonWild;
  const cMatch = isWild(c) || c === firstNonWild;
  if (aMatch && bMatch && cMatch) {
    const sym = SLOTS_SYMBOLS.find(x=>x.s===firstNonWild);
    return Math.round(betPerLine * (sym ? sym.p3 : 5));
  }
  // Pair pays on first two columns only (left-to-right), with wild substitution
  const firstTwoNonWild = !isWild(a) ? a : (!isWild(b) ? b : '🃏');
  const a2 = isWild(a) || a === firstTwoNonWild;
  const b2 = isWild(b) || b === firstTwoNonWild;
  if (a2 && b2) {
    const sym = SLOTS_SYMBOLS.find(x=>x.s===firstTwoNonWild);
    return Math.round(betPerLine * (sym ? sym.p2 : 1.5));
  }
  return 0;
}
function ensureCasinoUI() {
  if (!state.ui || typeof state.ui !== 'object') state.ui = {};
  if (!state.ui.casino || typeof state.ui.casino !== 'object') {
    state.ui.casino = { betPerLine: 100, lines: 5, grid: slotsGrid(), spinning: false, lastWin: 0, freeSpins: 0, sound: true, volume: 0.06 };
  }
  const ui = state.ui.casino;
  if (!Array.isArray(ui.grid)) ui.grid = slotsGrid();
  for (let r=0;r<3;r++) {
    if (!Array.isArray(ui.grid[r])) ui.grid[r] = [];
    for (let c=0;c<3;c++) if (typeof ui.grid[r][c] !== 'string') ui.grid[r][c] = slotsPick();
  }
  if (typeof ui.betPerLine !== 'number' || !isFinite(ui.betPerLine)) ui.betPerLine = 100;
  if (typeof ui.lines !== 'number' || !isFinite(ui.lines)) ui.lines = 5;
  ui.lines = Math.max(1, Math.min(7, ui.lines));
  if (typeof ui.freeSpins !== 'number' || !isFinite(ui.freeSpins)) ui.freeSpins = 0;
  // If page re-rendered mid-spin previously, ensure it is reset
  if (ui.spinning !== false) ui.spinning = false;
}

function renderCasino() {
  const view = document.getElementById('view');
  view.innerHTML = '';
  try {
    ensureCasinoUI();
    const ui = state.ui.casino;
  const panel = el('div', { class: 'panel' }, [ el('div', { class: 'row' }, [ el('h3', { text: 'Casino — Slots' }), el('div', { class: 'spacer' }), el('span', { class: 'tag info', text: `${ui.lines} lines` }) ]) ]);
  const cont = document.createElement('div'); cont.className = 'slots'; panel.appendChild(cont);
  const layout = document.createElement('div'); layout.className = 'slots-layout'; cont.appendChild(layout);

  // Left column: timeline of past spins
  const leftCol = document.createElement('div'); leftCol.className = 'side'; layout.appendChild(leftCol);
  const timeline = document.createElement('div'); timeline.className = 'panelish timeline'; leftCol.appendChild(timeline);
  timeline.appendChild(el('div', { class: 'subtle', text: 'Timeline' }));
  const tlItems = document.createElement('div'); tlItems.className = 'items'; timeline.appendChild(tlItems);

  // Center: machine
  const machine = document.createElement('div'); layout.appendChild(machine);
  const marquee = document.createElement('div'); marquee.className = 'marquee'; marquee.textContent = 'Vegas 3×3'; machine.appendChild(marquee);
  const cab = document.createElement('div'); cab.className = 'cabinet'; machine.appendChild(cab);
  // Win counter (mechanical-style) above the reels
  const counter = document.createElement('div'); counter.className = 'win-counter';
  // Currency symbol element (fixed, non-flipping)
  const cur = document.createElement('div'); cur.className = 'counter-currency'; cur.textContent = currencySymbol(); counter.appendChild(cur);
  cab.appendChild(counter);
  const stage = document.createElement('div'); stage.className = 'stage'; cab.appendChild(stage);
  const reelsWrap = document.createElement('div'); reelsWrap.className = 'reels'; stage.appendChild(reelsWrap);
    const cellEls = [];
    for (let r=0;r<3;r++) {
      for (let c=0;c<3;c++) {
        const d = document.createElement('div'); d.className = 'cell'; d.textContent = (ui.grid[r]&&ui.grid[r][c]) || slotsPick();
        reelsWrap.appendChild(d); cellEls.push({el:d,r,c});
      }
    }
    // Controls (options under machine)
  const optionsBox = document.createElement('div'); optionsBox.className = 'panelish optionsbox'; machine.appendChild(optionsBox);
  const controls = document.createElement('div'); controls.className = 'controls'; optionsBox.appendChild(controls);
    const selBet = document.createElement('select'); [50,100,250,500,1000].forEach(v=>{ const o=document.createElement('option'); o.value=String(v); o.textContent=fmt.format(v); if(ui.betPerLine===v)o.selected=true; selBet.appendChild(o); });
    selBet.onchange = ()=>{ ui.betPerLine = parseInt(selBet.value,10)||100; updateTotal(); saveState(); };
    const selLines = document.createElement('select'); [1,3,5,7].forEach(v=>{ const o=document.createElement('option'); o.value=String(v); o.textContent=`${v} lines`; if(ui.lines===v)o.selected=true; selLines.appendChild(o); });
    selLines.onchange = ()=>{ ui.lines = parseInt(selLines.value,10)||3; updateTotal(); saveState(); };
    const total = document.createElement('span'); total.className='total';
    function updateTotal(){ total.textContent = `Total Bet: ${fmt.format(ui.betPerLine*ui.lines)}`; }
    updateTotal();
    const spinBtn = el('button', { class: 'btn good', text: 'Spin 🎰' });
  spinBtn.onclick = ()=> spinSlotsMulti(cellEls, spinBtn, stage);
    // Sound toggle + volume
    controls.appendChild(selBet); controls.appendChild(selLines); controls.appendChild(total);
    const spinBox = document.createElement('div'); spinBox.className = 'panelish spinbox'; machine.appendChild(spinBox);
    spinBox.appendChild(spinBtn);
    // Free spins badge directly under the Spin button (centered by spinBox grid)
  const fsBadge = document.createElement('div'); fsBadge.className = 'fs-badge'; fsBadge.setAttribute('data-role','fs'); spinBox.appendChild(fsBadge);

  // Right column: Total winnings first, then rules, then paytable
  const colRight = document.createElement('div'); colRight.className = 'side'; layout.appendChild(colRight);
  const profitBox = document.createElement('div'); profitBox.className = 'panelish profit'; colRight.appendChild(profitBox);
  const profitLabel = document.createElement('div'); profitLabel.className='subtle'; profitLabel.textContent='Total Winnings'; profitBox.appendChild(profitLabel);
  const profitValue = document.createElement('div'); profitValue.className='result'; profitBox.appendChild(profitValue);
  const rulesBox = document.createElement('div'); rulesBox.className = 'panelish rules'; colRight.appendChild(rulesBox);
  const rulesInner = document.createElement('div'); rulesInner.className = 'inner'; rulesBox.appendChild(rulesInner);
  rulesInner.appendChild(el('div', { class: 'subtle', text: 'Rules' }));
  const rulesList = document.createElement('ul'); rulesInner.appendChild(rulesList);
  ;['Pays left-to-right on active lines','Three in a row pays most','Pairs pay on first two symbols only','🃏 is Wild and substitutes on lines','3+ 🃏 anywhere award 5 Free Spins','Choose lines (1/3/5/7) and bet per line','Gambling carries risk — play responsibly'].forEach(t=>{ const li=document.createElement('li'); li.textContent=t; rulesList.appendChild(li); });
  // Left timeline was not created earlier, create now if missing
  const colLeft = layout.firstChild; // slots .side timeline container
  if (colLeft && colLeft.classList && colLeft.classList.contains('side')) {
    const tl = colLeft.querySelector('.timeline .items');
    if (tl) { tl.innerHTML = ''; }
  }
  // Paytable under rules
  const pay = document.createElement('div'); pay.className='panelish paytable'; colRight.appendChild(pay);
  SLOTS_SYMBOLS.slice().reverse().forEach(sym=>{
    pay.appendChild(el('div',{text:sym.s}));
    pay.appendChild(el('div',{text:`3× ${sym.p3}x`}));
    pay.appendChild(el('div',{text:`2× ${sym.p2}x`}));
  });
  view.appendChild(panel);
  // draw initial payline guides
  requestAnimationFrame(()=> {
    drawSlotsLines(stage, cellEls, ui.lines, []);
    setWinCounter((ui.lastWin||0), false);
    updateCounterCurrency();
    renderFreeSpins();
    renderTimeline();
    renderProfit();
    syncTimelineHeight();
  });
  } catch (e) {
    const err = document.createElement('div'); err.className='panel'; err.textContent = 'Casino failed to render: ' + (e && e.message ? e.message : String(e));
    view.appendChild(err);
  }
}
function spinSlotsMulti(cellEls, spinBtn, stage){
  ensureCasinoUI();
  const ui = state.ui.casino;
  if (ui.spinning) return;
  const bet = Math.max(10, ui.betPerLine) * Math.max(1, Math.min(7, ui.lines));
  const isFree = (ui.freeSpins||0) > 0;
  const actualStake = isFree ? 0 : bet;
  if (!isFree && state.money < bet) { showToast('Not enough cash for this bet.', 'warn'); return; }
  ui.spinning = true; spinBtn.disabled=true;
  // initialize audio on user gesture and play start cue
  casinoEnsureAudio();
  if (ui.sound !== false) casinoPlayStart();
  // start continuous spin sound
  casinoSpinStart();
  // Reset counter to 0 immediately on spin start
  setWinCounter(0, false);
  if (isFree) { ui.freeSpins = Math.max(0, (ui.freeSpins||0) - 1); saveState(); }
  renderFreeSpins();
  if (actualStake > 0) addMoney(-actualStake, 'Slots spin');
  // clear win highlights
  document.querySelectorAll('.slots .cell.win').forEach(e=>e.classList.remove('win'));
  // spin animation (randomize then settle)
  // Preview active lines briefly, then spin
  drawSlotsLines(stage, cellEls, ui.lines, 'preview');
  const previewMs = 350;
  // Precompute final grid so each column can settle to its real symbols when it stops
  const finalGrid = slotsGrid();
  setTimeout(()=>{
    clearSlotsLines(stage);
    // Fallback with column intervals to ensure visible updates across browsers
    const durations = [900, 1050, 1200];
    const delays = [0, 140, 280];
    let running = 0;
    const timers = [];
    // mark spinning and start intervals per column
    [0,1,2].forEach(col => {
      const colCells = cellEls.filter(c => c.c === col);
      colCells.forEach(c => c.el.classList.add('spin'));
      running++;
      const startCol = Date.now() + delays[col];
      const endAt = startCol + durations[col];
      const t = setInterval(()=>{
        const now = Date.now();
        if (now < startCol) return; // wait column delay
        // update visible symbols for this column
        colCells.forEach(c => { c.el.textContent = slotsPick(); });
        if (now >= endAt) {
          clearInterval(t);
          timers[col] = null;
          running--;
          // stop thunk and fix values immediately for this column
          colCells.forEach(c => { c.el.classList.remove('spin'); c.el.classList.add('stop'); c.el.textContent = finalGrid[c.r][c.c]; });
          casinoPlayStop(col);
          setTimeout(()=> colCells.forEach(c => c.el.classList.remove('stop')), 240);
          if (running === 0) finish();
        }
      }, 80);
      timers[col] = t;
    });
    // Safety fallback: ensure finish is called even if a timer was throttled
    setTimeout(()=>{ if (running > 0) { timers.forEach(x=> x && clearInterval(x)); finish(); } }, Math.max(...durations) + Math.max(...delays) + 200);
  }, previewMs);
  function finish(){
    const grid = finalGrid; ui.grid = grid;
    cellEls.forEach(c=>{ c.el.classList.remove('spin'); c.el.textContent = grid[c.r][c.c]; });
    casinoSpinStop();
    // evaluate lines
    const linesToEval = PAYLINES.slice(0, Math.max(1, Math.min(PAYLINES.length, ui.lines)));
    let totalWin = 0; const winners=[];
    linesToEval.forEach((ln, li)=>{
      const w = linePayout(grid, ln, ui.betPerLine);
      if (w>0) { totalWin += w; winners.push({ln}); }
    });
    // highlight winners
    winners.forEach(w=>{ const ln = w.ln; for(let c=0;c<3;c++){ const r=ln[c]; const cell = cellEls.find(x=>x.r===r && x.c===c); if(cell) cell.el.classList.add('win'); } });
    // draw lines, highlighting winners, with flash after all columns stopped
    const winnerIdx = winners.map(w=> PAYLINES.findIndex(pl=> pl.length===w.ln.length && pl.every((v,i)=>v===w.ln[i]))).filter(i=>i>=0);
    drawSlotsLines(stage, cellEls, ui.lines, winnerIdx);
    ui.lastWin = totalWin;
    if (totalWin>0) { addMoney(totalWin, 'Slots win'); addXP(Math.min(25, Math.round(totalWin/400)), 'Slots'); }
    else addXP(2, 'Slots');
    if (totalWin>0) casinoPlayWin(totalWin);
    // Award free spins if 3+ wilds anywhere on the grid
    try {
      const flat = grid.flat();
      const wilds = flat.filter(s => s === '🃏').length;
      if (wilds >= 3) {
        ui.freeSpins = (ui.freeSpins||0) + 5;
        showToast('Free Spins +5 (🃏)', 'good');
        renderFreeSpins();
      }
    } catch {}
    // Update recent list with descriptive entry
    if (!Array.isArray(ui.recent)) ui.recent = [];
    const desc = buildWinnersDescription(winners);
    ui.recent.push({ net: totalWin - actualStake, total: actualStake, win: totalWin, desc, free: isFree });
    if (ui.recent.length > 100) ui.recent.shift();
    saveState(); ui.spinning=false; spinBtn.disabled=false;
    // Result text removed (counter and timeline cover feedback)
    setWinCounter(totalWin, true);
    renderTimeline();
    renderProfit();
    syncTimelineHeight();
  }

  function renderRecent(){ renderTimeline(); syncTimelineHeight(); }
}

function buildWinnersDescription(winners){
  if (!winners || !winners.length) return 'No winning lines';
  const names = ['Top','Middle','Bottom','Diag ↓','Diag ↑','V-Top','V-Bot'];
  return winners.map(w => {
    const idx = PAYLINES.findIndex(pl=> pl.length===w.ln.length && pl.every((v,i)=>v===w.ln[i]));
    const name = idx>=0 ? names[idx] : 'Line';
    const ln = w.ln;
    const a = state.ui.casino.grid[ln[0]][0], b = state.ui.casino.grid[ln[1]][1], c = state.ui.casino.grid[ln[2]][2];
    const firstNonWild = !isWild(a) ? a : (!isWild(b) ? b : (!isWild(c) ? c : '🃏'));
    const triple = (isWild(a)||a===firstNonWild) && (isWild(b)||b===firstNonWild) && (isWild(c)||c===firstNonWild);
    const pair = (isWild(a)||a===(!isWild(a)?a:(!isWild(b)?b:'🃏'))) && (isWild(b)||b===(!isWild(a)?a:(!isWild(b)?b:'🃏')));
    const count = triple ? 3 : 2;
    const sym = firstNonWild;
    return `${name}: ${count}× ${sym}`;
  }).join(', ');
}

// Render the left-side timeline of recent slot results
function renderTimeline() {
  try {
    ensureCasinoUI();
    const ui = state.ui.casino;
    const list = document.querySelector('.slots .timeline .items');
    if (!list) return;
    list.innerHTML = '';
    const items = (ui.recent || []).slice().reverse();
    items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'item';
      const net = document.createElement('div');
      net.className = 'net ' + (it.net >= 0 ? 'gain' : 'loss');
      net.textContent = (it.net >= 0 ? '+' : '') + fmt.format(it.net);
      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = it.desc || (it.net > 0 ? 'Win' : 'No win');
      row.appendChild(net);
      row.appendChild(desc);
      list.appendChild(row);
    });
  } catch {}
}

// Render the aggregate profit/loss on the right side
function renderProfit() {
  try {
    ensureCasinoUI();
    const ui = state.ui.casino;
    const pv = document.querySelector('.slots .profit .result');
    if (!pv) return;
    const sum = (ui.recent || []).reduce((a, b) => a + (b.net || 0), 0);
    pv.textContent = (sum >= 0 ? '+' : '') + fmt.format(sum);
    pv.classList.remove('gain','loss');
    if (sum > 0) pv.classList.add('gain');
    else if (sum < 0) pv.classList.add('loss');
  } catch {}
}

function renderFreeSpins() {
  try {
    ensureCasinoUI();
    const ui = state.ui.casino;
    const fs = (ui.freeSpins || 0);
    const el = document.querySelector('.slots .fs-badge[data-role="fs"]');
    if (!el) return;
    el.textContent = `Free Spins: ${fs}`;
    el.classList.toggle('active', fs > 0);
  } catch {}
}

// --- Casino Audio (simple WebAudio SFX) ---
let casinoAudio = { ctx: null, master: null, spin: null };
function casinoEnsureAudio(force = false) {
  try {
    ensureCasinoUI();
    if (!force && state.ui.casino.sound === false) return;
    if (!casinoAudio.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      const vol = Math.max(0, Math.min(1, (state.ui.casino.volume ?? 0.5)));
      gain.gain.value = (0.05 + 0.85 * vol); // much louder headroom
      gain.connect(ctx.destination);
      casinoAudio.ctx = ctx; casinoAudio.master = gain;
    }
    if (casinoAudio.ctx && casinoAudio.ctx.state === 'suspended') { casinoAudio.ctx.resume(); }
  } catch {}
}
function casinoPlayTest(){ try { casinoEnsureAudio(true); tone(660,0.12,'square',0.12); setTimeout(()=> tone(990,0.12,'square',0.12), 140); } catch {} }
function casinoApplyVolume(){ try { ensureCasinoUI(); if (!casinoAudio.master) return; const v = Math.max(0, Math.min(1, (state.ui.casino.volume ?? 0.5))); casinoAudio.master.gain.value = (0.05 + 0.85 * v); } catch {} }
function casinoPlayStart() { if (!casinoReady()) return; tone(740, 0.09, 'triangle', 0.08); setTimeout(()=> tone(880, 0.08, 'triangle', 0.08), 90); }
function casinoPlayStop(col){ if (!casinoReady()) return; const base=180; const f= base + col*40; thunk(f); }
function casinoPlayWin(amount){ if (!casinoReady()) return; const ratio = Math.min(1.5, Math.max(0.8, amount/5000)); const seq=[880,1040,1320,1760]; seq.forEach((f,i)=> setTimeout(()=> tone(f, 0.09, 'sine', 0.035*ratio), i*90)); }
function casinoPlayAward(){ if (!casinoReady()) return; const seq=[660,990,1320]; seq.forEach((f,i)=> setTimeout(()=> tone(f,0.12,'square',0.04), i*120)); }
function casinoReady(){ try { ensureCasinoUI(); return state.ui.casino.sound !== false && casinoAudio.ctx && casinoAudio.master; } catch { return false; } }
function casinoSpinStart(){ try { casinoSpinStop(); if (!casinoReady()) return; const ctx=casinoAudio.ctx; const src=ctx.createBufferSource(); const len = Math.floor(ctx.sampleRate * 0.4); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const data = buf.getChannelData(0); for(let i=0;i<len;i++){ data[i]=(Math.random()*2-1)*0.6; } src.buffer=buf; src.loop=true; const filter=ctx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.value=260; filter.Q.value=0.9; const g=ctx.createGain(); g.gain.value = sfxGain(0.10); src.connect(filter); filter.connect(g); g.connect(casinoAudio.master); src.start(); casinoAudio.spin = { src, g, filter }; } catch {} }
function casinoSpinStop(){ try { if (casinoAudio.spin && casinoAudio.spin.src){ casinoAudio.spin.src.stop(); } casinoAudio.spin=null; } catch {} }
function sfxGain(x){ try { const ua = navigator.userAgent; const isSafari = /Safari\//.test(ua) && !/Chrome\//.test(ua); return isSafari ? x*2.2 : x; } catch { return x; } }
function tone(freq, dur, type='sine', gain=0.03){ try { if (!casinoAudio.ctx) return; const ctx=casinoAudio.ctx; const osc=ctx.createOscillator(); const g=ctx.createGain(); osc.type=type; osc.frequency.value=freq; const gg=sfxGain(gain); g.gain.setValueAtTime(gg, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur); osc.connect(g); g.connect(casinoAudio.master); osc.start(); osc.stop(ctx.currentTime + dur); } catch {} }
function thunk(freq=160){ try { if (!casinoAudio.ctx) return; const ctx=casinoAudio.ctx; const osc=ctx.createOscillator(); const g=ctx.createGain(); osc.type='sine'; osc.frequency.setValueAtTime(freq, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(freq*0.6, ctx.currentTime+0.08); const gg=sfxGain(0.05); g.gain.setValueAtTime(gg, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.12); osc.connect(g); g.connect(casinoAudio.master); osc.start(); osc.stop(ctx.currentTime+0.13); // tiny noise click
  const buffer=ctx.createBuffer(1, ctx.sampleRate*0.06, ctx.sampleRate); const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++){ data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2); } const src=ctx.createBufferSource(); src.buffer=buffer; const gn=ctx.createGain(); gn.gain.value=0.03; src.connect(gn); gn.connect(casinoAudio.master); src.start(); } catch {} }
// Mechanical counter helpers for win display
function ensureCounterDigits(container, count) {
  const digitsNow = Array.from(container.querySelectorAll('.counter-digit'));
  const need = 6; // fixed six digits
  const anchor = container.querySelector('.counter-currency');
  while (digitsNow.length < need) {
    const d = document.createElement('div'); d.className = 'counter-digit';
    const wheel = document.createElement('div'); wheel.className = 'counter-wheel';
    for (let i=0;i<10;i++) { const v=document.createElement('div'); v.className='counter-val'; v.textContent=String(i); wheel.appendChild(v); }
    d.appendChild(wheel);
    container.insertBefore(d, anchor ? anchor.nextSibling : null); // insert after currency if present
    digitsNow.push(d);
  }
  while (container.querySelectorAll('.counter-digit').length > need) {
    const el = container.querySelector('.counter-digit');
    if (!el) break;
    el.remove();
  }
}

function setWinCounter(value, animate=true) {
  try {
    const container = document.querySelector('.slots .cabinet .win-counter');
    if (!container) return;
    const v = Math.max(0, Math.floor(value || 0));
    const s = String(v).padStart(6,'0');
    ensureCounterDigits(container, s.length);
    const digits = Array.from(container.querySelectorAll('.counter-digit'));
    // Map digits right-aligned
    const pad = Math.max(digits.length - s.length, 0);
    // Measure a digit height for precise pixel translations
    const digitHeight = digits[0] ? Math.round(digits[0].getBoundingClientRect().height) : 44;
    // Ensure wheel total height is 10 * digitHeight
    digits.forEach((d)=>{ const wheel=d.firstChild; if (!wheel) return; wheel.style.height = (digitHeight * 10) + 'px'; });
    // Move wheels
    digits.forEach((d)=>{ const wheel=d.firstChild; if (!wheel) return; if (!animate) { wheel.style.transition='none'; } });
    // If not animating, set instantly and restore transition next tick
    const apply = () => {
      digits.forEach((d, idx)=>{
        const wheel=d.firstChild; if (!wheel) return;
        const ch = s[idx-pad] ? Number(s[idx-pad]) : 0;
        wheel.style.transform = `translateY(-${ch * digitHeight}px)`;
      });
    };
    if (!animate) {
      apply();
      requestAnimationFrame(()=>{ digits.forEach(d=>{ const wheel=d.firstChild; if (wheel) wheel.style.transition=''; }); });
      return;
    }
    // Animate from current to target
    requestAnimationFrame(apply);
  } catch {}
}

function updateCounterCurrency() {
  try {
    const el = document.querySelector('.slots .cabinet .win-counter .counter-currency');
    if (el) el.textContent = currencySymbol();
  } catch {}
}

// Keep the left timeline max-height aligned to the height of the right panels
function syncTimelineHeight() {
  try {
    const items = document.querySelector('.slots .timeline .items');
    if (!items) return;
    items.style.maxHeight = '25rem';
  } catch {}
}

function drawSlotsLines(stage, cellEls, linesCount, winnerIdx){
  try {
    // Remove any existing overlay
    const old = stage.querySelector('.lines'); if (old) old.remove();
    // If preview requested, draw all enabled lines in base style
    if (winnerIdx === 'preview') {
      const overlay = document.createElement('div'); overlay.className = 'lines';
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); overlay.appendChild(svg);
      stage.appendChild(overlay);
      const rectStage = stage.getBoundingClientRect();
      const enabled = PAYLINES.slice(0, Math.max(1, Math.min(PAYLINES.length, linesCount)));
      enabled.forEach((ln)=>{
        const pts = [];
        for(let c=0;c<3;c++){
          const r = ln[c];
          const cell = cellEls.find(x=> x.r===r && x.c===c);
          if (!cell) return;
          const rc = cell.el.getBoundingClientRect();
          const x = rc.left - rectStage.left + rc.width/2;
          const y = rc.top - rectStage.top + rc.height/2;
          pts.push(`${x},${y}`);
        }
        if (pts.length===3){
          const pl = document.createElementNS('http://www.w3.org/2000/svg','polyline');
          pl.setAttribute('points', pts.join(' '));
          svg.appendChild(pl);
        }
      });
      return;
    }
    // Only draw when we actually have winners
    if (!Array.isArray(winnerIdx) || winnerIdx.length === 0) return;
    const overlay = document.createElement('div'); overlay.className = 'lines show';
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); overlay.appendChild(svg);
    stage.appendChild(overlay);
    const rectStage = stage.getBoundingClientRect();
    const enabled = PAYLINES.slice(0, Math.max(1, Math.min(PAYLINES.length, linesCount)));
    winnerIdx.forEach((idx)=>{
      const ln = enabled[idx];
      if (!ln) return;
      const pts = [];
      for(let c=0;c<3;c++){
        const r = ln[c];
        const cell = cellEls.find(x=> x.r===r && x.c===c);
        if (!cell) return;
        const rc = cell.el.getBoundingClientRect();
        const x = rc.left - rectStage.left + rc.width/2;
        const y = rc.top - rectStage.top + rc.height/2;
        pts.push(`${x},${y}`);
      }
      if (pts.length===3){
        const pl = document.createElementNS('http://www.w3.org/2000/svg','polyline');
        pl.setAttribute('points', pts.join(' '));
        pl.setAttribute('class','win');
        svg.appendChild(pl);
      }
    });
  } catch {}
}

function clearSlotsLines(stage){ const old = stage && stage.querySelector && stage.querySelector('.lines'); if (old) old.remove(); }

// Quick-access nav hub below the top nav
function renderNavHub() {
  const hub = document.getElementById('navHub');
  if (!hub) return;
  hub.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'nav-hub';
  for (const item of NAV) {
    const b = document.createElement('button');
    b.className = item.key === currentView ? 'active' : '';
    b.setAttribute('aria-label', item.label);
    b.onclick = () => setView(item.key);
    b.innerHTML = getIconSVG(item.icon) + ` <span class="label">${item.label}</span>`;
    wrap.appendChild(b);
  }
  hub.appendChild(wrap);
}

// renderNavHub kept inline; can be moved later if needed

// Options modal kept inline; can be moved later if needed

function setCurrency(code) {
  const old = state.currency || 'USD';
  const oldRate = CURRENCY_RATES[old] || 1;
  const newRate = CURRENCY_RATES[code];
  if (!newRate) { showToast('Unsupported currency code.', 'warn'); return; }
  const factor = newRate / oldRate;
  // Convert money-like values in place
  state.money = Math.round(state.money * factor);
  if (state.partsPrices && state.partsPrices.legal) {
    for (const k of Object.keys(state.partsPrices.legal)) state.partsPrices.legal[k] = Math.round((state.partsPrices.legal[k] || 0) * factor);
  }
  if (state.partsPrices && state.partsPrices.illegal) {
    for (const k of Object.keys(state.partsPrices.illegal)) state.partsPrices.illegal[k] = Math.round((state.partsPrices.illegal[k] || 0) * factor);
  }
  if (Array.isArray(state.illegalMarket)) {
    for (const car of state.illegalMarket) {
      if (typeof car.price === 'number') car.price = Math.round(car.price * factor);
      if (Array.isArray(car.priceHistory)) car.priceHistory = car.priceHistory.map(v => Math.round(v * factor));
      if (typeof car.basePrice === 'number') car.basePrice = Math.round(car.basePrice * factor);
      if (typeof car.boughtPrice === 'number') car.boughtPrice = Math.round(car.boughtPrice * factor);
    }
  }
  if (Array.isArray(state.garage)) {
    for (const car of state.garage) {
      if (typeof car.valuation === 'number') car.valuation = Math.round(car.valuation * factor);
      if (Array.isArray(car.valuationHistory)) car.valuationHistory = car.valuationHistory.map(v => Math.round(v * factor));
      if (typeof car.basePrice === 'number') car.basePrice = Math.round(car.basePrice * factor);
      if (typeof car.boughtPrice === 'number') car.boughtPrice = Math.round(car.boughtPrice * factor);
    }
  }
  if (state.modelTrends) {
    for (const k of Object.keys(state.modelTrends)) {
      if (Array.isArray(state.modelTrends[k])) state.modelTrends[k] = state.modelTrends[k].map(v => Math.round(v * factor));
    }
  }
  // Switch formatter and currency
  try { fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 0 }); } catch {}
  state.currency = code;
  saveState();
  showToast(`Currency set to ${code}.`, 'info');
  render();
}

function refreshAll() {
  refreshIllegalMarket();
  refreshPartsPrices();
  render();
  saveState();
}

// --- Init ---
maybeAutoResetOnExistingSave();
// Ensure any pre-existing save is migrated before first render
migrateState();
if (!state.illegalMarket.length) refreshIllegalMarket();
if (!Object.keys(state.partsPrices.legal).length) refreshPartsPrices();
ensureModelTrends();
// Apply currency from save
try { fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: state.currency || 'USD', maximumFractionDigits: 0 }); } catch {}
render();
startPartsTicker();
startIllegalTicker();
startIllegalListingRefresher();
renderDevPanel();
ensureToasts();
// Initial sticky positioning and keep it in sync on resize
updateStickyOffsets();
window.addEventListener('resize', scheduleStickyMeasure);
// Start progress bar and hide loader after first render settles
startLoaderProgress();
setTimeout(hideLoader, 450);

// Toast helpers moved to ui.js
// --- Storage (garage capacity) ---
function garageCapacity() { return 1 + (state.garagesPurchased || 0); }
function nextGarageCost() {
  const n = state.garagesPurchased || 0;
  const raw = 15000 * Math.pow(1.5, n) * getRate();
  return Math.round(raw / 500) * 500;
}
function buyGarageSlot() {
  const cost = nextGarageCost();
  if (state.money < cost) {
    showToast(`Not enough cash. Need ${fmt.format(cost)}.`, 'warn');
    return;
  }
  state.garagesPurchased = (state.garagesPurchased || 0) + 1;
  addMoney(-cost, 'Bought additional garage slot');
  addXP(8, 'Property upgrade');
  showToast('Garage slot purchased.', 'good');
  render();
  saveState();
}

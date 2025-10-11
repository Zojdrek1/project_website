// --- Utility helpers ---
import { PARTS, MODELS } from './js/data.js';
import { TUNING_OPTIONS, nextTuningStage, tuningStage, tuningBonus, clampTuningLevel } from './js/tuning.js';
import { state, setState, defaultState, saveState, migrateState, getCurrentSlot, loadSlotIntoState, createNewStateForSlot } from './js/state.js';
import { showMainMenu, hideMainMenu } from './js/menu.js';
import { canRace, simulateRaceOutcome, RACE_EVENTS, LEAGUE_RANKS } from './js/race.js';
import { ensureModelTrends, refreshIllegalMarket, refreshPartsPrices, tickPartsPricesCore, tickIllegalMarketCore, PRICE_HISTORY_MAX, PARTS_TICK_MS, ILLEGAL_TICK_MS, ILLEGAL_LISTING_REFRESH_MS } from './js/economy.js';
import { showRaceAnimation } from './js/raceAnimation.js';
import { el, ensureToasts, showToast, renderNavUI, renderCenterNavUI, drawSparkline, renderMarketView, updateMarketPricesAndTrendsUI, renderMarketListingsSection, renderMarketTrendsSection, renderMarketOwnedTrendsSection, renderMarketAllTrendsSection, renderGarageFullView, renderGarageCarsSection, updatePartsPricesUI as updatePartsPricesUI_M, renderRacesView, layoutCarBreakdown, getBodyStyle, getSilhouettePath } from './js/ui.js';
import { initCasino } from './js/casino.js';
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

const formatMoney = (value) => fmt.format(value);

const {
  setCasinoSession,
  ensureCasinoUI,
  renderCasino,
  casinoEnsureAudio,
  casinoApplyVolume,
  casinoPlayTest,
  renderFreeSpins,
  showBonusPick,
} = initCasino({
  state,
  saveState,
  addMoney,
  addXP,
  currencySymbol,
  formatMoney,
  render,
});

const TUNING_BY_KEY = Object.fromEntries(TUNING_OPTIONS.map(opt => [opt.key, opt]));

function ensureCarTuning(car) {
  if (!car) return;
  if (typeof car.basePerf !== 'number' || !isFinite(car.basePerf)) car.basePerf = typeof car.perf === 'number' ? car.perf : 0;
  if (!car.tuning || typeof car.tuning !== 'object') car.tuning = {};
  for (const opt of TUNING_OPTIONS) {
    const level = clampTuningLevel(opt, car.tuning[opt.key] ?? 0);
    car.tuning[opt.key] = level;
  }
  recalcCarPerf(car);
}

function recalcCarPerf(car) {
  if (!car) return;
  if (typeof car.basePerf !== 'number' || !isFinite(car.basePerf)) car.basePerf = typeof car.perf === 'number' ? car.perf : 0;
  const avg = avgCondition(car);
  const conditionFactor = 0.6 + 0.4 * Math.max(0, Math.min(1, avg / 100));
  const tuning = tuningBonus(car.tuning || {});
  car.tuningBonus = tuning;
  const base = car.basePerf ?? 0;
  car.perf = Math.max(0, Math.round(base * conditionFactor + tuning));
}

function upgradeCarTuning(garageIndex, key, { skipRefresh = false } = {}) {
  const car = state.garage[garageIndex];
  if (!car) return;
  const option = TUNING_BY_KEY[key];
  if (!option) return;
  ensureCarTuning(car);
  const level = car.tuning[key] ?? 0;
  const nextStage = nextTuningStage(option, level);
  if (!nextStage) {
    showToast(`${option.name} already maxed.`, 'info');
    return;
  }
  const cost = nextStage.cost || 0;
  if (state.money < cost) {
    showToast('Not enough cash for this tuning upgrade.', 'warn');
    return;
  }
  addMoney(-cost, `${option.name} tuning`);
  car.tuning[key] = clampTuningLevel(option, level + 1);
  recalcCarPerf(car);
  showToast(`${option.name} upgraded to ${nextStage.label}.`, 'good');
  saveState();
  if (!skipRefresh) refreshGarageUI();
}

function resetCarTuning(garageIndex, key, { skipRefresh = false } = {}) {
  const car = state.garage[garageIndex];
  if (!car) return;
  const option = TUNING_BY_KEY[key];
  if (!option) return;
  ensureCarTuning(car);
  if ((car.tuning[key] ?? 0) === 0) {
    showToast(`${option.name} is already stock.`, 'info');
    return;
  }
  car.tuning[key] = 0;
  recalcCarPerf(car);
  showToast(`${option.name} reset to stock.`, 'info');
  saveState();
  if (!skipRefresh) refreshGarageUI();
}

function ensureLeagueState() {
  if (!state.league || typeof state.league !== 'object') {
    state.league = { rank: 0, match: 0, history: [], completedRanks: [], champion: false, season: 1 };
  }
  const league = state.league;
  if (typeof league.rank !== 'number' || !isFinite(league.rank)) league.rank = 0;
  league.rank = Math.max(0, Math.min(LEAGUE_RANKS.length - 1, Math.round(league.rank)));
  if (typeof league.match !== 'number' || !isFinite(league.match)) league.match = 0;
  const maxMatches = LEAGUE_RANKS[league.rank]?.opponents?.length ?? 0;
  league.match = Math.max(0, Math.min(maxMatches, Math.round(league.match)));
  if (!Array.isArray(league.history)) league.history = [];
  if (!Array.isArray(league.completedRanks)) league.completedRanks = [];
  if (typeof league.champion !== 'boolean') league.champion = false;
  if (typeof league.season !== 'number' || !isFinite(league.season) || league.season < 1) league.season = 1;
  if (typeof league.lossStreak !== 'number' || !isFinite(league.lossStreak) || league.lossStreak < 0) league.lossStreak = 0;
  if (!league.flash || typeof league.flash !== 'object') league.flash = null;
  return league;
}

function setLeagueFlash(text, tone = 'info') {
  const league = ensureLeagueState();
  league.flash = { text, tone, ts: Date.now() };
}

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
let gameBooted = false;
let menuHandlers = null;

// In-memory cache to avoid retrying the same missing image URLs
const failedImgCache = new Set();

function scheduleRender() {
  if (renderTimer) return; // already scheduled
  renderTimer = setTimeout(() => {
    renderTimer = null;
    switch (currentView) {
      case 'market':
        refreshMarketUI();
        break;
      case 'garage':
        refreshGarageUI();
        break;
      case 'street_races':
        refreshStreetRacesUI();
        break;
      case 'league':
        refreshLeagueUI();
        break;
      default:
        render();
    }
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

function resetState(options = {}) {
  const slot = getCurrentSlot();
  const fresh = defaultState({ ...options, slot: typeof slot === 'number' ? slot : null });
  setState(fresh, typeof slot === 'number' ? slot : undefined);
  ensureModelTrends();
  refreshAll();
}

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
  const car = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    model: fromModel.model,
    basePrice: base,
    perf: fromModel.perf,
    basePerf: fromModel.perf,
    price,
    priceHistory: [price],
    parts,
    boughtPrice: null,
    tuning: {},
    tuningBonus: 0,
  };
  ensureCarTuning(car);
  return car;
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
    refreshGarageUI();
    refreshMarketUI();
    updateMoney();
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
    if (currentView === 'market') refreshMarketUI();
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
  refreshMarketUI();
  refreshGarageUI();
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
  ensureCarTuning(car);
  state.garage.push(car);
  state.illegalMarket.splice(idx, 1);
  addXP(15, `Acquired ${car.model}`);
  saveState();
  refreshMarketUI();
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
  saveState();
  refreshGarageUI();
  refreshMarketUI();
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

function raceCar(garageIndex, eventId) {
  const car = state.garage[garageIndex];
  const event = RACE_EVENTS.find(e => e.id === eventId);
  if (!car || !event) return;
  if (!canRace(car)) { showToast('Vehicle must be repaired before racing.', 'warn'); return; }
  if (state.money < event.entryFee) { showToast(`Not enough cash for the ${fmt.format(event.entryFee)} entry fee.`, 'warn'); return; }

  addMoney(-event.entryFee, `${event.name} entry fee`);
  const outcome = simulateRaceOutcome(car, event.opponentPerf);

  showRaceAnimation(car, event, outcome, () => {
    // Apply outcome after animation
    if (outcome.failedPart) {
      const key = outcome.failedPart;
      const cond = car.parts[key] ?? 100;
      const drop = Math.round(rand(15, 35));
      car.parts[key] = clamp(cond - drop, 0, 100);
      car.failed = true;
      pushLog(`${car.model} DNF — ${PARTS.find(p=>p.key===key).name} failed during the race! Vehicle must be repaired before racing again.`);
      recalcCarPerf(car);
    } else if (outcome.win) {
      addMoney(event.prize, `${event.name} win`);
      addXP(Math.round(12 + car.perf / 10), `${car.model} race win`);
      addHeat(event.heat, 'Street race');
    } else {
      pushLog(`${car.model} lost the race. No payout.`);
      addXP(4, `${car.model} race experience`);
      addHeat(Math.round(event.heat / 2), 'Street race');
    }
    const wearPart = sample(PARTS).key;
    car.parts[wearPart] = clamp((car.parts[wearPart] ?? 100) - Math.round(rand(5, 12)), 0, 100);
    recalcCarPerf(car);
    saveState();
    refreshGarageUI();
    refreshMarketUI();
    refreshStreetRacesUI();
  });
}

function leagueCurrentRank() {
  const league = ensureLeagueState();
  const rankIndex = Math.min(LEAGUE_RANKS.length - 1, Math.max(0, league.rank));
  return {
    league,
    rankIndex,
    rank: LEAGUE_RANKS[rankIndex] || null,
  };
}

function recordLeagueHistory(entry) {
  ensureLeagueState();
  state.league.history.unshift({ ...entry, ts: Date.now(), season: state.league.season });
  if (state.league.history.length > 25) state.league.history.length = 25;
}

function startLeagueNewSeason() {
  const league = ensureLeagueState();
  if (!league.champion) {
    showToast('Win the league finals to start a new season.', 'info');
    return;
  }
  league.season += 1;
  league.rank = 0;
  league.match = 0;
  league.champion = false;
  league.completedRanks = [];
  league.lossStreak = 0;
  league.flash = null;
  pushLog(`New League Season ${league.season} begins!`);
  saveState();
  refreshLeagueUI();
}

function raceLeague(garageIndex) {
  const { league, rank, rankIndex } = leagueCurrentRank();
  if (!rank) {
    showToast('League data unavailable.', 'warn');
    return;
  }
  if (league.champion && rankIndex >= LEAGUE_RANKS.length - 1 && league.match >= rank.opponents.length) {
    showToast('You have already claimed the league championship! Start a new season to keep racing.', 'info');
    return;
  }
  const opponent = rank.opponents[league.match] || rank.opponents[rank.opponents.length - 1];
  if (!opponent) {
    showToast('League rank complete. Advance to the next stage!', 'good');
    return;
  }
  const car = state.garage[garageIndex];
  if (!car) return;
  if (!canRace(car)) { showToast('Vehicle must be repaired before racing.', 'warn'); return; }
  const entryFee = opponent.entryFee || rank.entryFee || 0;
  if (entryFee && state.money < entryFee) { showToast(`Need ${fmt.format(entryFee)} entry fee.`, 'warn'); return; }
  if (entryFee) addMoney(-entryFee, `${rank.name} entry`);

  const event = {
    id: `${rank.id}_${league.match}`,
    name: `${rank.name} — ${opponent.name}`,
    entryFee,
    prize: opponent.reward,
    heat: opponent.heat ?? rank.heat ?? 4,
    trackType: opponent.trackType || 'league',
  };
  const notes = {};
  const finalMatch = league.match >= rank.opponents.length - 1;
  const isLastRank = rankIndex >= LEAGUE_RANKS.length - 1;
  if (finalMatch) {
    if (isLastRank) {
      notes.win = 'You\'ve become the Midnight League Champion!';
    } else {
      const nextRank = LEAGUE_RANKS[rankIndex + 1];
      if (nextRank) notes.win = `You\'ve been promoted to ${nextRank.name}!`;
    }
  }
  if (!league.champion && league.rank > 0 && league.lossStreak >= 1) {
    const prevRank = LEAGUE_RANKS[league.rank - 1];
    if (prevRank) notes.loss = `You\'ve been relegated back to ${prevRank.name}.`;
  }
  if (Object.keys(notes).length) event.resultNotes = notes;
  const outcome = simulateRaceOutcome(car, opponent.perf);
  const markLeagueLoss = () => {
    const current = Number.isFinite(league.lossStreak) ? league.lossStreak : 0;
    league.lossStreak = current + 1;
    if (league.lossStreak >= 2 && league.rank > 0 && !league.champion) {
      const prevIndex = Math.max(0, league.rank - 1);
      const prevRank = LEAGUE_RANKS[prevIndex];
      league.rank = prevIndex;
      const prevOpponents = prevRank?.opponents || [];
      league.match = Math.max(0, prevOpponents.length - 1);
      league.lossStreak = 0;
      const rankName = prevRank?.name || 'a lower rank';
      showToast(`Relegated to ${rankName} after consecutive losses.`, 'warn');
      pushLog(`League relegation — dropped back to ${rankName}.`);
      setLeagueFlash(`Relegated to ${rankName}. Win the next heat to recover momentum.`, 'warn');
    }
  };

  showRaceAnimation(car, event, outcome, () => {
    if (outcome.failedPart) {
      const key = outcome.failedPart;
      const cond = car.parts[key] ?? 100;
      const drop = Math.round(rand(18, 36));
      car.parts[key] = clamp(cond - drop, 0, 100);
      car.failed = true;
      pushLog(`${car.model} retired — ${PARTS.find(p=>p.key===key).name} failed during the league heat!`);
      recordLeagueHistory({ rank: rank.id, rankName: rank.name, opponent: opponent.name, result: 'fail', car: car.model });
      markLeagueLoss();
      recalcCarPerf(car);
    } else if (outcome.win) {
      if (event.prize) addMoney(event.prize, `${rank.name} win`);
      const xpGain = opponent.xp ?? Math.round(18 + car.perf / 8);
      addXP(xpGain, `${car.model} league win`);
      addHeat(event.heat ?? 4, 'League race');
      recordLeagueHistory({ rank: rank.id, rankName: rank.name, opponent: opponent.name, result: 'win', car: car.model });
      league.lossStreak = 0;
      league.match += 1;
      if (league.match >= rank.opponents.length) {
        const rankId = rank.id;
        if (!league.completedRanks.includes(rankId)) {
          if (rank.trophyReward) addMoney(rank.trophyReward, `${rank.name} trophy purse`);
          if (rank.trophyXp) addXP(rank.trophyXp, `${rank.name} championship`);
          league.completedRanks.push(rankId);
        }
        if (league.rank < LEAGUE_RANKS.length - 1) {
          league.rank += 1;
          league.match = 0;
          showToast(`Advanced to ${LEAGUE_RANKS[league.rank].name}!`, 'good');
          const nextRank = LEAGUE_RANKS[league.rank];
          if (nextRank) setLeagueFlash(`Promoted to ${nextRank.name}! New rivals unlocked.`, 'good');
        } else {
          league.champion = true;
          league.match = rank.opponents.length;
          showToast('You are the Midnight League Champion!', 'good');
          setLeagueFlash('Midnight League complete! You hold the crown.', 'good');
        }
      }
    } else {
      pushLog(`${car.model} lost the league heat against ${opponent.name}.`);
      addXP(Math.round(6 + car.perf / 14), `${car.model} league experience`);
      addHeat(Math.max(1, Math.round((event.heat ?? rank.heat ?? 4) / 2)), 'League race');
      recordLeagueHistory({ rank: rank.id, rankName: rank.name, opponent: opponent.name, result: 'loss', car: car.model });
      markLeagueLoss();
    }
    const wearPart = sample(PARTS).key;
    car.parts[wearPart] = clamp((car.parts[wearPart] ?? 100) - Math.round(rand(6, 14)), 0, 100);
    recalcCarPerf(car);
    saveState();
    refreshGarageUI();
    refreshMarketUI();
    refreshLeagueUI();
  });
}

function repairCar(garageIndex, partKey, source, { skipRefresh = false } = {}) {
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
  recalcCarPerf(car);
  addXP(source === 'legal' ? 4 : 6, `Serviced ${partKey}`);
  saveState();
  if (!skipRefresh) refreshGarageUI();
}

// --- Rendering ---
const NAV = [
  { key: 'market', label: 'Illegal Market', icon: 'cart' },
  { key: 'garage', label: 'Garage', icon: 'garage' },
  { key: 'street_races', label: 'Street Races', icon: 'flag' },
  { key: 'league', label: 'League Racing', icon: 'trophy' },
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
    onNewGame: () => showToast('Back to the main menu? Current progress auto-saves.', 'info', [
      { label: 'Stay', action: () => {} },
      {
        label: 'Back to Menu',
        action: () => {
          const slot = getCurrentSlot();
          if (menuHandlers) showMainMenu(menuHandlers);
        },
      }
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

const handleMarketBuy = (carId) => {
  const idx = state.illegalMarket.findIndex(c => c.id === carId);
  if (idx !== -1) buyCar(idx);
};

function refreshMarketUI() {
  if (currentView !== 'market') return;
  const listings = document.querySelector('[data-section="market-listings"]');
  if (listings) {
    renderMarketListingsSection({
      container: listings,
      state,
      PARTS,
      fmt,
      level: state.level,
      onBuyCar: handleMarketBuy,
    });
  }
  const trends = document.querySelector('[data-section="market-trends"]');
  if (trends) renderMarketTrendsSection({ container: trends, state, fmt });
  const ownedPanel = document.querySelector('[data-panel="market-owned"]');
  const ownedGrid = document.querySelector('[data-section="market-owned"]');
  if (ownedGrid) {
    if (state.garage && state.garage.length) {
      ownedPanel?.classList.remove('is-empty');
      renderMarketOwnedTrendsSection({ container: ownedGrid, state, fmt, isSellConfirm, onSellClickById });
    } else {
      ownedPanel?.classList.add('is-empty');
      ownedGrid.innerHTML = '';
      ownedGrid.appendChild(el('div', { class: 'subtle', text: 'No cars owned yet.' }));
    }
  }
  const allGrid = document.querySelector('[data-section="market-all"]');
  if (allGrid) renderMarketAllTrendsSection({ container: allGrid, state, MODELS, fmt, modelId, ensureModelTrends });
}

function refreshGarageUI() {
  if (currentView !== 'garage') return;
  const storageTag = document.querySelector('[data-storage-tag="garage"]');
  if (storageTag) storageTag.textContent = `${state.garage.length}/${garageCapacity()} slots used`;
  const buyBtn = document.querySelector('[data-storage-buy="garage"]');
  if (buyBtn) buyBtn.textContent = `Buy Slot (${fmt.format(nextGarageCost())})`;
  if (!state.garage.length) {
    const view = document.getElementById('view');
    if (view) {
      renderGarageFullView({
        state,
        PARTS,
        fmt,
        modelId,
        avgCondition,
        conditionStatus,
        isCarOpen,
        onToggleCarOpen: (id) => toggleCarOpen(id),
        isSellConfirm,
        onSellClickById,
        onRaceCar: (idx) => raceCar(idx),
        onOpenImagePicker: (model) => openImagePicker(model),
        onRepairCar: (idx, key, source) => repairCar(idx, key, source),
        tuningOptions: TUNING_OPTIONS,
        onTuneUp: (idx, key) => upgradeCarTuning(idx, key),
        onResetTuning: (idx, key) => resetCarTuning(idx, key),
        garageCapacity,
        nextGarageCost,
        onBuyGarageSlot: () => buyGarageSlot(),
        saveState,
      });
    }
    return;
  }
  const cards = document.querySelector('[data-section="garage-cars"]');
  if (cards) {
    renderGarageCarsSection({
      container: cards,
      state,
      PARTS,
      fmt,
      modelId,
      avgCondition,
      conditionStatus,
      isCarOpen,
      onToggleCarOpen: (id) => toggleCarOpen(id),
      isSellConfirm,
      onSellClickById,
      onRaceCar: (idx) => raceCar(idx),
      onOpenImagePicker: (model) => openImagePicker(model),
      onRepairCar: (idx, key, source) => repairCar(idx, key, source),
      tuningOptions: TUNING_OPTIONS,
      onTuneUp: (idx, key) => upgradeCarTuning(idx, key),
      onResetTuning: (idx, key) => resetCarTuning(idx, key),
      saveState: () => saveState(),
    });
  }
}

function refreshStreetRacesUI() {
  if (currentView !== 'street_races') return;
  renderRacesView({
    state,
    RACE_EVENTS,
    canRace,
    onRaceCar: raceCar,
    fmt,
    mode: 'street',
  });
}

function refreshLeagueUI() {
  if (currentView !== 'league') return;
  renderRacesView({
    state,
    RACE_EVENTS,
    canRace,
    onRaceCar: raceCar,
    fmt,
    mode: 'league',
    leagueData: LEAGUE_RANKS,
    leagueState: ensureLeagueState(),
    onLeagueRace: (garageIndex) => raceLeague(garageIndex),
    onLeagueReset: () => startLeagueNewSeason(),
    onDismissLeagueFlash: () => clearLeagueFlash(),
  });
}

function isCarOpen(id) { return !!(state.ui && state.ui.openCars && state.ui.openCars[id]); }
function toggleCarOpen(id, { skipRefresh = false } = {}) {
  if (!state.ui) state.ui = { openCars: {} };
  if (!state.ui.openCars) state.ui.openCars = {};
  state.ui.openCars[id] = !state.ui.openCars[id];
  const collapsible = document.querySelector(`[data-garage-card="${id}"] .collapsible`);
  if (collapsible) {
    collapsible.classList.toggle('open', !!state.ui.openCars[id]);
    requestAnimationFrame(() => {
      const container = collapsible.querySelector('.car-breakdown');
      if (container) layoutCarBreakdown(container);
    });
  } else if (!skipRefresh) {
    refreshGarageUI();
  }
  saveState();
}

function toggleDevPanel() {
  if (!state.ui) state.ui = { openCars: {}, showDev: false };
  state.ui.showDev = !state.ui.showDev;
  renderDevPanel();
  saveState();
}

function clearLeagueFlash() {
  const league = ensureLeagueState();
  if (league.flash) {
    league.flash = null;
    saveState();
    refreshLeagueUI();
  }
}

function cheatMoney(amount) {
  addMoney(amount, 'Dev: money');
}
function cheatLevels(n) {
  state.level = Math.max(1, (state.level || 1) + n);
  pushLog(`Dev: level set to ${state.level}`);
  updateLevelUI();
  saveState();
  refreshMarketUI();
  refreshGarageUI();
  refreshStreetRacesUI();
  refreshLeagueUI();
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

  addSection('race', 'Race', '🏁', [
    [
      el('button', {
        class: 'btn bad',
        text: 'Force Part Failure (Next Race)',
        onclick: () => {
          window.__icsForcePartFailure = true;
          showToast('Next race will force a part failure!', 'warn');
        }
      }),
      el('button', {
        class: 'btn good',
        text: 'Repair All Cars',
        onclick: () => {
          if (!state.garage) return;
          state.garage.forEach(car => {
            Object.keys(car.parts).forEach(k => car.parts[k] = 100);
            car.failed = false;
          });
          showToast('All cars fully repaired!', 'good');
          if (typeof window.render === 'function') window.render();
        }
      })
    ]
  ]);

  addSection('heat', 'Heat', '🔥', [
    [ el('button', { class: 'btn warn', text: '+10 Heat', onclick: () => addHeat(10, 'Dev heat') }),
      el('button', { class: 'btn', text: 'Clear Heat', onclick: () => addHeat(-100, 'Dev clear') }) ],
  ]);

  addSection('casino', 'Casino', '🎰', [
    [ el('button', { class: 'btn good', text: '+5 Free Spins', onclick: () => devAddFreeSpins(5) }),
      el('button', { class: 'btn good', text: '+50 Free Spins', onclick: () => devAddFreeSpins(50) }),
      el('button', { class: 'btn warn', text: 'Clear Free Spins', onclick: () => devAddFreeSpins('clear') }) ],
    [ el('button', { class: 'btn', text: 'Trigger Bonus 💰', onclick: () => devTriggerScatterNow() }),
      el('button', { class: 'btn', text: 'Force Next Bonus', onclick: () => devForceScatterNext() }) ],
  ]);
}

function ensureDevUI() {
  if (!state.ui) state.ui = {};
  if (!state.ui.dev) state.ui.dev = { sections: { eco: true, prog: true, heat: false, casino: true } };
  if (!state.ui.dev.sections) state.ui.dev.sections = { eco: true, prog: true, heat: false, casino: true };
}
function isDevSectionOpen(key) { ensureDevUI(); return !!state.ui.dev.sections[key]; }
function toggleDevSection(key) { ensureDevUI(); state.ui.dev.sections[key] = !state.ui.dev.sections[key]; saveState(); }

function devTriggerScatterNow(){
  try { ensureCasinoUI(); const bet = (state.ui.casino.betPerLine||0) * (state.ui.casino.lines||1); showBonusPick(bet, ()=> saveState()); } catch {}
}
function devForceScatterNext(){
  try { ensureCasinoUI(); state.ui.casino.forceScatterNext = true; saveState(); showToast('Dev: will trigger Bonus on next spin', 'info'); } catch {}
}

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
      refreshGarageUI();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// getBodyStyle and getSilhouettePath provided by ui.js

function renderLog(container) {
  container.innerHTML = '';
  for (const msg of state.log) {
    const line = document.createElement('div');
    line.textContent = '• ' + msg;
    container.appendChild(line);
  }
}

// Dashboard removed; topbar now shows status, and notifications display side toasts

function refreshMarketAndRender() { refreshIllegalMarket(); saveState(); refreshMarketUI(); }

// --- Mini chart renderer ---
// drawSparkline moved to ui.js

// --- In-place UI updates (no layout bounce) ---
function updateMarketPricesAndTrends() { updateMarketPricesAndTrendsUI({ state, MODELS, fmt, modelId, drawSparkline }); }

function updatePartsPricesUI() { updatePartsPricesUI_M({ state, PARTS, fmt }); }

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
    renderMarketView({ state, PARTS, MODELS, fmt, modelId, ensureModelTrends, onBuyCar: handleMarketBuy, isSellConfirm, onSellClickById });
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
      tuningOptions: TUNING_OPTIONS,
      onTuneUp: (idx, key) => upgradeCarTuning(idx, key),
      onResetTuning: (idx, key) => resetCarTuning(idx, key),
      garageCapacity,
      nextGarageCost,
      onBuyGarageSlot: () => buyGarageSlot(),
      saveState: () => saveState(),
    });
  } else if (currentView === 'street_races') {
    renderRacesView({
      state,
      RACE_EVENTS,
      canRace,
      onRaceCar: raceCar,
      fmt,
      mode: 'street',
    });
  } else if (currentView === 'league') {
    renderRacesView({
      state,
      RACE_EVENTS,
      canRace,
      onRaceCar: raceCar,
      fmt,
      mode: 'league',
      leagueData: LEAGUE_RANKS,
      leagueState: ensureLeagueState(),
      onLeagueRace: (garageIndex) => raceLeague(garageIndex),
      onLeagueReset: () => startLeagueNewSeason(),
      onDismissLeagueFlash: () => clearLeagueFlash(),
    });
  } else if (currentView === 'casino') {
    renderCasino();
  }
  setCasinoSession(currentView === 'casino');
  // options now displayed as a modal, not a separate view
  ensureToasts();
  // relayout breakdowns on each render
  requestAnimationFrame(() => {
    document.querySelectorAll('.car-breakdown').forEach(layoutCarBreakdown);
  });
}


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
  updateMoney();
  refreshMarketUI();
  refreshGarageUI();
  refreshStreetRacesUI();
  refreshLeagueUI();
}

function refreshAll() {
  refreshIllegalMarket();
  refreshPartsPrices();
  saveState();
  refreshMarketUI();
  refreshGarageUI();
  refreshStreetRacesUI();
  refreshLeagueUI();
  updateMoney();
  if (!['market','garage','street_races','league'].includes(currentView)) {
    render();
  }
}

async function initializeGame({ skipLoader = false } = {}) {
  if (gameBooted) {
    try { fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: state.currency || 'USD', maximumFractionDigits: 0 }); } catch {}
    render();
    return true;
  }
  gameBooted = true;
  if (!skipLoader) startLoaderProgress();
  await new Promise(resolve => setTimeout(resolve, 100));
  migrateState();
  if (!state.illegalMarket.length) refreshIllegalMarket();
  if (!Object.keys(state.partsPrices.legal).length) refreshPartsPrices();
  ensureModelTrends();
  ensureLeagueState();
  state.illegalMarket.forEach(ensureCarTuning);
  state.garage.forEach(ensureCarTuning);
  try { fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: state.currency || 'USD', maximumFractionDigits: 0 }); } catch {}
  startPartsTicker();
  startIllegalTicker();
  startIllegalListingRefresher();
  renderDevPanel();
  ensureToasts();
  updateStickyOffsets();
  window.addEventListener('resize', scheduleStickyMeasure);
  render();
  hideLoader();
  return true;
}

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
  saveState();
  updateMoney();
  refreshGarageUI();
}

document.addEventListener('DOMContentLoaded', () => {
  menuHandlers = {
    onLoadGame: (slotIndex) => {
      if (!loadSlotIntoState(slotIndex)) {
        showToast('No save data in this slot yet.', 'warn');
        return false;
      }
      currentView = 'market';
      hideMainMenu();
      return initializeGame();
    },
    onNewGame: (slotIndex, opts) => {
      createNewStateForSlot(slotIndex, opts);
      currentView = 'market';
      hideMainMenu();
      return initializeGame();
    },
  };
  showMainMenu(menuHandlers);
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});

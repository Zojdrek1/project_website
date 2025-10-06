// --- Utility helpers ---
let fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const rand = (min, max) => Math.random() * (max - min) + min;
const randi = (min, max) => Math.floor(rand(min, max));
const sample = (arr) => arr[randi(0, arr.length)];
const chance = (p) => Math.random() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const CURRENCY_RATES = { USD: 1, GBP: 0.79, EUR: 0.93, JPY: 155, PLN: 4.0 };
const getRate = () => CURRENCY_RATES[(state && state.currency) || 'USD'] || 1;

// --- Game Data ---
const PARTS = [
  // Engine system (split)
  { key: 'engine_block', name: 'Engine Block', basePrice: 4000 },
  { key: 'induction', name: 'Induction (Turbo/Intake)', basePrice: 1500 },
  { key: 'fuel_system', name: 'Fuel System', basePrice: 800 },
  { key: 'cooling', name: 'Cooling (Radiator/Pump)', basePrice: 600 },
  { key: 'ignition', name: 'Ignition (Coils/Plugs)', basePrice: 300 },
  { key: 'timing', name: 'Timing (Belt/Chain)', basePrice: 700 },
  { key: 'alternator', name: 'Alternator', basePrice: 350 },
  { key: 'ecu', name: 'ECU/Sensors', basePrice: 900 },
  // Drivetrain
  { key: 'transmission', name: 'Transmission', basePrice: 2500 },
  { key: 'clutch', name: 'Clutch', basePrice: 700 },
  { key: 'differential', name: 'Differential', basePrice: 1200 },
  // Running gear
  { key: 'suspension', name: 'Suspension', basePrice: 1000 },
  { key: 'tires', name: 'Tires', basePrice: 800 },
  { key: 'brakes', name: 'Brakes', basePrice: 600 },
  // Other
  { key: 'exhaust', name: 'Exhaust', basePrice: 900 },
  { key: 'battery', name: 'Battery', basePrice: 200 },
  { key: 'electronics', name: 'Interior Electronics', basePrice: 600 },
];

const MODELS = [
  // Existing fictional/global set
  { model: 'Cobra GT', basePrice: 18000, perf: 80 },
  { model: 'Veloce RS', basePrice: 24000, perf: 88 },
  { model: 'Sakura Sport', basePrice: 14000, perf: 72 },
  { model: 'Highland 4x4', basePrice: 16000, perf: 65 },
  { model: 'Sting S', basePrice: 30000, perf: 95 },
  { model: 'Metro Hatch', basePrice: 8000, perf: 50 },
  { model: 'Silver Arrow', basePrice: 22000, perf: 78 },
  { model: 'Comet R', basePrice: 28000, perf: 90 },
  { model: 'Falcon V6', basePrice: 12000, perf: 62 },
  { model: 'Zephyr Coupe', basePrice: 20000, perf: 75 },

  // JDM additions (well‑known enthusiast models)
  { model: 'Nissan Skyline GT-R R34', basePrice: 65000, perf: 98 },
  { model: 'Toyota Supra Mk4 (A80)', basePrice: 52000, perf: 92 },
  { model: 'Mazda RX-7 (FD3S)', basePrice: 38000, perf: 88 },
  { model: 'Honda NSX (NA2)', basePrice: 90000, perf: 96 },
  { model: 'Mitsubishi Lancer Evo VI', basePrice: 32000, perf: 86 },
  { model: 'Subaru Impreza WRX STI (GC8)', basePrice: 28000, perf: 84 },
  { model: 'Nissan Silvia (S15)', basePrice: 26000, perf: 82 },
  { model: 'Toyota AE86 Trueno', basePrice: 18000, perf: 70 },
  { model: 'Honda S2000 (AP2)', basePrice: 30000, perf: 85 },
  { model: 'Nissan 300ZX (Z32)', basePrice: 22000, perf: 78 },
  { model: 'Toyota Chaser (JZX100)', basePrice: 26000, perf: 80 },
  { model: 'Toyota Aristo V300 (JZS161)', basePrice: 24000, perf: 76 },
];

// --- State ---
const defaultState = () => ({
  day: 1,
  money: 20000,
  level: 1,
  xp: 0,
  currency: 'USD',
  heat: 0,
  illegalMarket: [],
  garage: [],
  garagesPurchased: 0,
  partsPrices: { legal: {}, illegal: {} },
  modelTrends: {},
  ui: { openCars: {}, showDev: false },
  assets: { modelImages: {} },
  log: [
    'Welcome to ICS. Buy, fix, flip, and race.',
    'Prices change daily. Illegal parts are cheaper, but sketchy...',
  ],
});

let state = loadState() || defaultState();
// Migrate older saves to new shape (levels/percent parts/etc.)
function migrateState() {
  try {
    if (!state || typeof state !== 'object') return;
    if (typeof state.level !== 'number' || !isFinite(state.level)) state.level = 1;
    if (typeof state.xp !== 'number' || !isFinite(state.xp)) state.xp = 0;
    if (typeof state.garagesPurchased !== 'number' || !isFinite(state.garagesPurchased)) state.garagesPurchased = 0;
    if (typeof state.currency !== 'string') state.currency = 'USD';
    if (typeof state.heat !== 'number' || !isFinite(state.heat)) state.heat = 0;
    if (!state.modelTrends) state.modelTrends = {};
    if (!state.ui || typeof state.ui !== 'object') state.ui = { openCars: {}, showDev: false };
    if (!state.ui.openCars) state.ui.openCars = {};
    if (typeof state.ui.showDev !== 'boolean') state.ui.showDev = false;
    if (!state.assets || typeof state.assets !== 'object') state.assets = { modelImages: {} };
    if (!state.assets.modelImages) state.assets.modelImages = {};
    if (!state.partsPrices || typeof state.partsPrices !== 'object') state.partsPrices = { legal: {}, illegal: {} };
    if (!state.partsPrices.legal) state.partsPrices.legal = {};
    if (!state.partsPrices.illegal) state.partsPrices.illegal = {};
    const normalizeCar = (car) => {
      if (!car || !car.parts) return;
      if (typeof car.failed !== 'boolean') car.failed = false;
      for (const p of PARTS) {
        const v = car.parts[p.key];
        if (typeof v === 'boolean') car.parts[p.key] = v ? 100 : 0;
        else if (typeof v !== 'number' || !isFinite(v)) car.parts[p.key] = 100;
        else car.parts[p.key] = Math.max(0, Math.min(100, Math.round(v)));
      }
    };
    if (Array.isArray(state.garage)) state.garage.forEach(normalizeCar);
    if (Array.isArray(state.illegalMarket)) state.illegalMarket.forEach(normalizeCar);
  } catch {}
}
migrateState();

// --- Price ticker config ---
const PARTS_TICK_MS = 8000; // parts update interval
const ILLEGAL_TICK_MS = 7000; // illegal market price drift
const ILLEGAL_LISTING_REFRESH_MS = 180000; // refresh shop listings every 3 minutes
const PRICE_HISTORY_MAX = 60; // points per car chart
let partsTicker = null;
let illegalTicker = null;
let renderTimer = null;
const RERENDER_DEBOUNCE_MS = 900; // coalesce frequent updates
let illegalRefreshTimer = null;

function scheduleRender() {
  if (renderTimer) return; // already scheduled
  renderTimer = setTimeout(() => {
    renderTimer = null;
    render();
  }, RERENDER_DEBOUNCE_MS);
}

function saveState() {
  try { localStorage.setItem('ics_state', JSON.stringify(state)); } catch {}
}
function loadState() {
  try {
    const s = localStorage.getItem('ics_state');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
function resetState() { state = defaultState(); ensureModelTrends(); refreshAll(); saveState(); }

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

function refreshIllegalMarket() {
  const n = marketSlots ? marketSlots() : 5;
  ensureModelTrends();
  state.illegalMarket = Array.from({ length: n }, () => {
    const baseModel = sample(MODELS);
    const car = newCar(baseModel);
    // Seed car listing price history from model index adjusted by condition
    const avgCond = PARTS.reduce((a, p) => a + (car.parts[p.key] ?? 100), 0) / PARTS.length;
    const condFactor = 0.5 + (avgCond / 100) * 0.5; // 0.5..1.0
    const series = state.modelTrends[baseModel.model] || [Math.round(baseModel.basePrice * getRate())];
    const seedLen = Math.min(30, series.length);
    const start = series.slice(series.length - seedLen);
    const hist = start.map(v => {
      const noisy = Math.round(v * condFactor * rand(0.97, 1.03));
      const baseNow = Math.round(baseModel.basePrice * getRate());
      return clamp(noisy, Math.round(baseNow * 0.5), Math.round(baseNow * 1.5));
    });
    car.priceHistory = hist;
    car.price = hist[hist.length - 1];
    return car;
  });
}

function refreshPartsPrices() {
  state.partsPrices.legal = {};
  state.partsPrices.illegal = {};
  const r = getRate();
  for (const p of PARTS) {
    state.partsPrices.legal[p.key] = Math.round(p.basePrice * r * rand(0.9, 1.2));
    state.partsPrices.illegal[p.key] = Math.round(p.basePrice * r * rand(0.6, 1.0));
  }
}

function tickPartsPrices() {
  // Drift current prices like a stock ticker, within bounds around base price
  const r = getRate();
  for (const p of PARTS) {
    const base = p.basePrice * r;
    // Legal market drifts gently
    const curL = state.partsPrices.legal[p.key] ?? Math.round(base * 1.0);
    const mulL = rand(0.97, 1.03);
    const nextL = Math.round(curL * mulL);
    state.partsPrices.legal[p.key] = clamp(nextL, Math.round(base * 0.8), Math.round(base * 1.3));

    // Illegal market is more volatile
    const curI = state.partsPrices.illegal[p.key] ?? Math.round(base * 0.8);
    const mulI = rand(0.95, 1.05);
    const nextI = Math.round(curI * mulI);
    state.partsPrices.illegal[p.key] = clamp(nextI, Math.round(base * 0.5), Math.round(base * 1.1));
  }
  // In-place UI update to avoid layout bounce
  if (currentView === 'parts' || currentView === 'garage') updatePartsPricesUI();
}

function startPartsTicker() {
  if (partsTicker) clearInterval(partsTicker);
  partsTicker = setInterval(() => {
    tickPartsPrices();
    saveState();
  }, PARTS_TICK_MS);
}

function tickIllegalMarket() {
  // Drift listed car prices and record history
  for (const car of state.illegalMarket) {
    const base = car.basePrice;
    const cur = car.price;
    const mul = rand(0.96, 1.05);
    let next = Math.round(cur * mul);
    const min = Math.round(base * 0.55);
    const max = Math.round(base * 1.5);
    if (next < min) next = min;
    if (next > max) next = max;
    car.price = next;
    if (!Array.isArray(car.priceHistory)) car.priceHistory = [];
    car.priceHistory.push(next);
    if (car.priceHistory.length > PRICE_HISTORY_MAX) car.priceHistory.shift();
  }
  // Drift owned car valuations similarly, bounded by condition
  for (const car of state.garage) {
    const avg = avgCondition(car);
    const condFactor = 0.5 + (avg / 100) * 0.5;
    const base = car.basePrice * condFactor;
    if (typeof car.valuation !== 'number') car.valuation = Math.round(base);
    const mul = rand(0.97, 1.03);
    let next = Math.round(car.valuation * mul);
    const min = Math.round(base * 0.7);
    const max = Math.round(base * 1.3);
    if (next < min) next = min;
    if (next > max) next = max;
    car.valuation = next;
    if (!Array.isArray(car.valuationHistory)) car.valuationHistory = [];
    car.valuationHistory.push(next);
    if (car.valuationHistory.length > PRICE_HISTORY_MAX) car.valuationHistory.shift();
  }
  // Drift global model indices
  ensureModelTrends();
  for (const m of MODELS) {
    const base = m.basePrice;
    const series = state.modelTrends[m.model] || [base];
    const cur = series[series.length - 1] || Math.round(base);
    const mul = rand(0.97, 1.03);
    let next = Math.round(cur * mul);
    const min = Math.round(base * 0.6);
    const max = Math.round(base * 1.4);
    if (next < min) next = min;
    if (next > max) next = max;
    series.push(next);
    if (series.length > PRICE_HISTORY_MAX) series.shift();
    state.modelTrends[m.model] = series;
  }
  // Heat decay and possible events
  if ((state.heat || 0) > 0) {
    state.heat = Math.max(0, state.heat - 1);
    updateHeatUI();
  }
  maybeHeatEvent();
  if (currentView === 'market') updateMarketPricesAndTrends();
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
    tickIllegalMarket();
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

function ensureModelTrends() {
  if (!state.modelTrends) state.modelTrends = {};
  for (const m of MODELS) {
    const key = m.model;
    if (!Array.isArray(state.modelTrends[key]) || !state.modelTrends[key].length) {
      // Prefill a full series via bounded random walk around base price
      const base = Math.round(m.basePrice * getRate());
      const series = [];
      let cur = Math.round(base * rand(0.9, 1.1));
      for (let i = 0; i < PRICE_HISTORY_MAX; i++) {
        const mul = rand(0.98, 1.02);
        cur = Math.round(cur * mul);
        const min = Math.round(base * 0.6);
        const max = Math.round(base * 1.4);
        if (cur < min) cur = min;
        if (cur > max) cur = max;
        series.push(cur);
      }
      state.modelTrends[key] = series;
    }
  }
}

function modelId(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

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
function canRace(car) { return !car.failed; }

function simulateRaceOutcome(car, opponentPerf) {
  const avg = avgCondition(car);
  // Rating: performance plus small condition bonus
  const myRating = car.perf + (avg - 60) * 0.3;
  const oppRating = (opponentPerf ?? sample(MODELS).perf) + rand(-6, 6);
  // Logistic win chance based on rating difference
  const diff = myRating - oppRating;
  const winChance = clamp(1 / (1 + Math.exp(-diff / 18)), 0.15, 0.9);
  // Failure risk baseline even at 100%, increases with weak parts
  let failRisk = 0.02;
  let failedPart = null;
  for (const p of PARTS) {
    const cond = car.parts[p.key] ?? 100;
    if (cond < 60) failRisk += (60 - cond) / 100 * 0.15;
    if (!failedPart && cond < 60 && chance((60 - cond) / 100 * 0.3)) failedPart = p.key;
  }
  if (!failedPart && chance(failRisk)) failedPart = sample(PARTS).key;
  const win = !failedPart && chance(winChance);
  // House edge on odds: expected value slightly negative
  const margin = 0.12;
  const fairMult = 1 / winChance - 1; // net profit multiplier at fair odds
  const netProfitMult = Math.max(0, fairMult * (1 - margin));
  return { win, failedPart, winChance, netProfitMult };
}

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
  { key: 'parts', label: 'Parts Market', icon: 'wrench' },
  { key: 'races', label: 'Races', icon: 'flag' },
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
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  // Centered nav group
  const center = document.createElement('div');
  center.className = 'nav-center';
  for (const item of NAV) {
    const btn = document.createElement('button');
    btn.className = item.key === currentView ? 'active' : '';
    btn.setAttribute('aria-label', item.label);
    btn.onclick = () => setView(item.key);
    btn.innerHTML = getIconSVG(item.icon) + `<span class="label">${item.label}</span>`;
    center.appendChild(btn);
  }
  nav.appendChild(center);

  // Options on the right
  const right = document.createElement('div');
  right.className = 'options';
  const cogBtn = document.createElement('button');
  cogBtn.setAttribute('aria-label', 'Options');
  cogBtn.innerHTML = getIconSVG('cog') + '<span class="label">Options</span>';
  cogBtn.onclick = toggleOptionsMenu;
  right.appendChild(cogBtn);

  const pop = document.createElement('div');
  pop.id = 'optionsPop';
  pop.className = 'options-pop' + (state.ui && state.ui.showOptions ? ' open' : '');
  // New Game
  const newBtn = document.createElement('button');
  newBtn.className = 'btn warn';
  newBtn.textContent = 'New Game';
  newBtn.onclick = () => {
    showToast('Start a new game?', 'info', [
      { label: 'Cancel', action: () => {} },
      { label: 'Confirm', action: () => resetState() }
    ]);
    hideOptionsMenu();
  };
  pop.appendChild(newBtn);
  // Dev Tools toggle
  const devBtn2 = document.createElement('button');
  devBtn2.className = 'btn';
  devBtn2.textContent = (state.ui && state.ui.showDev) ? 'Hide Dev Tools' : 'Show Dev Tools';
  devBtn2.onclick = () => { toggleDevPanel(); hideOptionsMenu(); };
  pop.appendChild(devBtn2);

  right.appendChild(pop);
  nav.appendChild(right);
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

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  for (const item of NAV) {
    const btn = document.createElement('button');
    btn.className = item.key === currentView ? 'active' : '';
    btn.setAttribute('aria-label', item.label);
    btn.onclick = () => setView(item.key);
    btn.innerHTML = getIconSVG(item.icon) + `<span class="label">${item.label}</span>`;
    nav.appendChild(btn);
  }
  // Right-side actions
  const flexSpacer = document.createElement('div');
  flexSpacer.style.flex = '1';
  nav.appendChild(flexSpacer);

  const resetBtn = document.createElement('button');
  resetBtn.innerHTML = getIconSVG('refresh') + '<span class="label">New Game</span>';
  resetBtn.onclick = () => { if (confirm('Start a new game?')) resetState(); };
  nav.appendChild(resetBtn);

  const devBtn = document.createElement('button');
  devBtn.className = 'dev-chip';
  devBtn.innerHTML = getIconSVG('wrench') + '<span class="label">Dev</span>';
  devBtn.onclick = toggleDevPanel;
  nav.appendChild(devBtn);
}

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

function renderDevPanel() {
  let panel = document.getElementById('devPanel');
  if (!state.ui || !state.ui.showDev) {
    if (panel) panel.remove();
    return;
  }
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'devPanel';
    panel.className = 'dev-panel';
    document.body.appendChild(panel);
  }
  panel.innerHTML = '';
  panel.appendChild(el('h4', { text: 'Dev Cheats' }));
  panel.appendChild(el('div', { class: 'row' }, [
    el('button', { class: 'btn', text: '+$10,000', onclick: () => cheatMoney(10000) }),
    el('button', { class: 'btn', text: '+$100,000', onclick: () => cheatMoney(100000) }),
  ]));
  panel.appendChild(el('div', { class: 'row' }, [
    el('button', { class: 'btn', text: '+1 Level', onclick: () => cheatLevels(1) }),
    el('button', { class: 'btn', text: '+5 Levels', onclick: () => cheatLevels(5) }),
    el('button', { class: 'btn warn', text: '+10 Heat', onclick: () => addHeat(10, 'Dev heat') }),
    el('button', { class: 'btn', text: 'Clear Heat', onclick: () => addHeat(-100, 'Dev clear') }),
  ]));
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
      render();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function getBodyStyle(model) {
  const m = model.toLowerCase();
  if (m.includes('hatch')) return 'hatch';
  if (m.includes('4x4') || m.includes('suv') || m.includes('highland')) return 'suv';
  if (m.includes('chaser') || m.includes('aristo') || m.includes('sedan') || m.includes('falcon')) return 'sedan';
  if (m.includes('nsx') || m.includes('supra') || m.includes('rx-7') || m.includes('skyline') || m.includes('s2000') || m.includes('300zx') || m.includes('silvia') || m.includes('comet') || m.includes('sting') || m.includes('cobra') || m.includes('zephyr') || m.includes('veloce') || m.includes('sakura') || m.includes('arrow')) return 'coupe';
  return 'coupe';
}

function getSilhouettePath(style) {
  switch (style) {
    case 'hatch':
      return 'M70 165 L70 135 L140 110 L260 110 L280 135 L450 135 Q470 135 485 150 L525 150 L525 185 L110 185 Z M180 185 A24 24 0 1 0 180 137 A24 24 0 1 0 180 185 Z M420 185 A24 24 0 1 0 420 137 A24 24 0 1 0 420 185 Z';
    case 'sedan':
      return 'M60 165 L60 130 Q80 120 140 120 L190 95 L330 95 L360 120 L460 120 Q490 120 510 140 L540 140 L540 180 L110 180 Z M180 180 A24 24 0 1 0 180 132 A24 24 0 1 0 180 180 Z M430 180 A24 24 0 1 0 430 132 A24 24 0 1 0 430 180 Z';
    case 'suv':
      return 'M60 160 L60 120 L120 100 L260 100 L300 110 L440 110 L480 120 L520 130 L520 175 L110 175 Z M170 175 A26 26 0 1 0 170 125 A26 26 0 1 0 170 175 Z M420 175 A26 26 0 1 0 420 125 A26 26 0 1 0 420 175 Z';
    case 'coupe':
    default:
      return 'M60 160 L60 120 Q70 110 110 110 L140 90 L240 90 L260 120 L430 120 Q460 120 480 140 L520 140 L520 180 L110 180 Z M170 180 A24 24 0 1 0 170 132 A24 24 0 1 0 170 180 Z M430 180 A24 24 0 1 0 430 132 A24 24 0 1 0 430 180 Z';
  }
}

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

function getIconSVG(name) {
  const wrap = (e) => `<span class="icon" aria-hidden="true">${e}</span>`;
  switch (name) {
    case 'home': return wrap('🏠');
    case 'cart': return wrap('🛒');
    case 'garage': return wrap('🚗');
    case 'wrench': return wrap('🔧');
    case 'flag': return wrap('🏁');
    case 'calendar': return wrap('📅');
    case 'refresh': return wrap('🔄');
    case 'cog': return wrap('⚙️');
    default: return wrap('•');
  }
}

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') {
      e.className = v;
    } else if (k === 'text') {
      e.textContent = v;
    } else if (k.startsWith('on')) {
      e[k] = v;
    } else if (typeof v === 'boolean') {
      // Properly handle boolean attributes like `disabled`
      if (v) e.setAttribute(k, '');
      // if false, do not set the attribute at all
    } else {
      e.setAttribute(k, v);
    }
  }
  for (const c of children) e.appendChild(c);
  return e;
}

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
function drawSparkline(canvas, points, color = '#57b6ff') {
  if (!points || points.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320;
  const cssH = canvas.clientHeight || 80;
  canvas.width = Math.max(1, Math.floor(cssW * dpr));
  canvas.height = Math.max(1, Math.floor(cssH * dpr));
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = cssW, h = cssH;
  ctx.clearRect(0, 0, w, h);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = 6;
  const n = points.length;
  const xFor = (i) => pad + (w - 2*pad) * (i / (n - 1));
  const yFor = (v) => {
    if (max === min) return h/2;
    const t = (v - min) / (max - min);
    return h - pad - (h - 2*pad) * t;
  };
  // background grid line
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, yFor(points[0]));
  ctx.lineTo(w, yFor(points[0]));
  ctx.stroke();
  // line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xFor(0), yFor(points[0]));
  for (let i = 1; i < n; i++) ctx.lineTo(xFor(i), yFor(points[i]));
  ctx.stroke();
  // gradient fill
  const grad = ctx.createLinearGradient(0, pad, 0, h - pad);
  grad.addColorStop(0, 'rgba(87,182,255,0.25)');
  grad.addColorStop(1, 'rgba(87,182,255,0.02)');
  ctx.fillStyle = grad;
  ctx.lineTo(xFor(n-1), h - pad);
  ctx.lineTo(xFor(0), h - pad);
  ctx.closePath();
  ctx.fill();
}

// --- In-place UI updates (no layout bounce) ---
function updateMarketPricesAndTrends() {
  for (const car of state.illegalMarket) {
    const priceEl = document.querySelector(`[data-car-price="${car.id}"]`);
    if (priceEl) priceEl.textContent = fmt.format(car.price);
    const tpriceEl = document.querySelector(`[data-car-tprice="${car.id}"]`);
    if (tpriceEl) tpriceEl.textContent = fmt.format(car.price);
    const canvas = document.querySelector(`canvas[data-car-spark="${car.id}"]`);
    if (canvas) drawSparkline(canvas, car.priceHistory || [car.price], '#57b6ff');
  }
  // Owned cars trends
  for (const car of state.garage) {
    const tpriceEl = document.querySelector(`[data-own-tprice="${car.id}"]`);
    if (tpriceEl) tpriceEl.textContent = fmt.format(car.valuation ?? 0);
    const canvas = document.querySelector(`canvas[data-own-spark="${car.id}"]`);
    if (canvas) {
      const pts = (car.valuationHistory && car.valuationHistory.length) ? car.valuationHistory : [(car.valuation ?? 0)];
      drawSparkline(canvas, pts, '#7ee787');
    }
    const plEl = document.querySelector(`[data-own-pl="${car.id}"]`);
    if (plEl) {
      const profit = (car.valuation ?? 0) - (car.boughtPrice ?? 0);
      plEl.textContent = `${profit >= 0 ? '+' : ''}${fmt.format(profit)}`;
      plEl.className = 'tag ' + (profit >= 0 ? 'ok' : 'bad');
    }
  }
  // All models trends
  ensureModelTrends();
  for (const m of MODELS) {
    const mid = modelId(m.model);
    const points = state.modelTrends[m.model] || [m.basePrice];
    const curVal = points[points.length - 1] || m.basePrice;
    const pEl = document.querySelector(`[data-model-price="${mid}"]`);
    if (pEl) pEl.textContent = fmt.format(curVal);
    const c = document.querySelector(`canvas[data-model-spark="${mid}"]`);
    if (c) drawSparkline(c, points, '#9aa4ff');
  }
}

function updatePartsPricesUI() {
  // Parts view table cells
  for (const p of PARTS) {
    const l = document.querySelector(`[data-part-legal="${p.key}"]`);
    if (l) l.textContent = fmt.format(state.partsPrices.legal[p.key]);
    const i = document.querySelector(`[data-part-illegal="${p.key}"]`);
    if (i) i.textContent = fmt.format(state.partsPrices.illegal[p.key]);
  }
  // Garage repair buttons (only visible for broken parts)
  document.querySelectorAll('[data-gprice][data-part]').forEach(btn => {
    const kind = btn.getAttribute('data-gprice');
    const partKey = btn.getAttribute('data-part');
    const price = state.partsPrices[kind]?.[partKey];
    if (typeof price === 'number') {
      const label = kind === 'legal' ? 'Legal ' : 'Illegal ';
      btn.textContent = label + fmt.format(price);
    }
  });
}

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
  const candidates = [
    imgSrc, // uploaded
    `assets/cars/${slug}.svg`,
    `Assets/Cars/${slug}.svg`,
    `assets/cars/${styleSlug}.svg`,
    `Assets/Cars/${styleSlug}.svg`,
  ].filter(Boolean);
  if (candidates.length) {
    const img = document.createElement('img');
    img.src = candidates[0];
    img.alt = car.model;
    img.className = 'car-photo';
    let i = 0;
    img.onerror = () => {
      i += 1;
      if (i < candidates.length) {
        img.src = candidates[i];
      } else if (img && img.parentNode) {
        img.parentNode.removeChild(img);
      }
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
      (() => { const t = el('span', { class: 'part-toggle', text: open ? '▾' : '▸' }); t.onclick = () => togglePartActions(carId, key, t); return t; })(),
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

function layoutCarBreakdown(container) {
  try {
    const rect = container.getBoundingClientRect();
    let maxBottom = rect.top + 320;
    container.querySelectorAll('.callout').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom > maxBottom) maxBottom = r.bottom;
    });
    const needed = Math.ceil(maxBottom - rect.top) + 12;
    container.style.height = needed + 'px';
  } catch {}
}

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
  if (toggleEl) toggleEl.textContent = m[key] ? '▾' : '▸';
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
  renderNavHub();
  updateMoney();
  // Wire top-right options cog opens modal
  const optionsCog = document.getElementById('optionsCog');
  if (optionsCog) optionsCog.onclick = () => showOptionsModal();
  const view = document.getElementById('view');
  if (!view) return;
  if (currentView === 'market') renderMarket();
  else if (currentView === 'garage') renderGarage();
  else if (currentView === 'parts') renderParts();
  else if (currentView === 'races') renderRaces();
  // options now displayed as a modal, not a separate view
  ensureToasts();
  // relayout breakdowns on each render
  requestAnimationFrame(() => {
    document.querySelectorAll('.car-breakdown').forEach(layoutCarBreakdown);
  });
}

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

function showOptionsModal() {
  hideOptionsModal();
  const modal = document.createElement('div');
  modal.className = 'options-modal open';
  modal.id = 'optionsModal';
  const backdrop = document.createElement('div');
  backdrop.className = 'options-backdrop';
  backdrop.onclick = hideOptionsModal;
  const panel = document.createElement('div');
  panel.className = 'options-panel options-wrap';
  panel.appendChild(el('h3', { text: 'Options' }));
  // Currency field
  const field = document.createElement('div');
  field.className = 'options-field';
  field.appendChild(el('strong', { text: 'Currency:' }));
  const sel = document.createElement('select');
  const opts = [ ['USD','US Dollar'], ['GBP','British Pound'], ['EUR','Euro'], ['JPY','Japanese Yen'], ['PLN','Polish Złoty'] ];
  opts.forEach(([code, name]) => {
    const o = document.createElement('option');
    o.value = code; o.textContent = `${code} — ${name}`; if ((state.currency||'USD') === code) o.selected = true; sel.appendChild(o);
  });
  sel.onchange = () => setCurrency(sel.value);
  field.appendChild(sel);
  panel.appendChild(field);
  // Actions
  const actions = document.createElement('div');
  actions.className = 'actions';
  const devBtn = el('button', { class: 'btn', text: (state.ui && state.ui.showDev) ? 'Hide Dev Tools' : 'Show Dev Tools' });
  devBtn.onclick = () => { toggleDevPanel(); };
  const newBtn = el('button', { class: 'btn warn', text: 'New Game' });
  newBtn.onclick = () => showToast('Start a new game?', 'info', [ { label: 'Cancel', action: () => {} }, { label: 'Confirm', action: () => resetState() } ]);
  const clearBtn = el('button', { class: 'btn danger', text: 'Clear Save' });
  clearBtn.onclick = () => { try { localStorage.removeItem('ics_state'); showToast('Save cleared. Starting new game…', 'info'); } catch {} resetState(); };
  actions.appendChild(devBtn); actions.appendChild(newBtn); actions.appendChild(clearBtn);
  panel.appendChild(actions);
  modal.appendChild(backdrop);
  modal.appendChild(panel);
  document.body.appendChild(modal);
  // Close on ESC
  window.addEventListener('keydown', optionsEscOnce, { once: true });
}
function hideOptionsModal() {
  const modal = document.getElementById('optionsModal');
  if (modal) modal.remove();
}
function optionsEscOnce(e) { if (e.key === 'Escape') hideOptionsModal(); }

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

// --- Toasts (notifications) ---
function ensureToasts() {
  if (!document.getElementById('toasts')) {
    const t = document.createElement('div');
    t.id = 'toasts';
    t.className = 'toasts';
    document.body.appendChild(t);
  }
}
function showToast(message, type = 'info', actions = null, timeoutMs = 4200) {
  ensureToasts();
  const cont = document.getElementById('toasts');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const text = document.createElement('div');
  text.textContent = message;
  toast.appendChild(text);
  if (actions && actions.length) {
    const act = document.createElement('div');
    act.className = 'actions';
    actions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = a.label;
      b.onclick = () => {
        try { a.action && a.action(); } finally {
          toast.classList.add('hide');
          setTimeout(() => toast.remove(), 240);
        }
      };
      act.appendChild(b);
    });
    toast.appendChild(act);
  }
  cont.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  if (!actions || !actions.length) {
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 240);
    }, timeoutMs);
  }
}
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

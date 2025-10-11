// State and persistence extracted from script.js
// Centralized state with migration and localStorage helpers

import { CURRENCY_RATES } from './economy.js';
import { PARTS, MODELS } from './data.js';
import { TUNING_OPTIONS, clampTuningLevel, tuningBonus } from './tuning.js';
import { LEAGUE_RANKS } from './race.js';

export const SAVE_SLOTS = 3;
const SLOT_PREFIX = 'ics_state_slot_';
const toSlotKey = (index) => `${SLOT_PREFIX}${index + 1}`;

const sanitizeMoney = (value, fallback) => {
  if (typeof value !== 'number' || !isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
};

const generateProfileId = () => {
  try { return crypto.randomUUID(); } catch {}
  return `profile-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * @typedef {Object} Car
 * @property {string} id
 * @property {string} model
 * @property {number} basePrice
 * @property {number} perf
 * @property {number} price
 * @property {number[]} priceHistory
 * @property {Record<string, number>} parts // 0–100 condition per part key
 * @property {number|null} boughtPrice
 * @property {number|undefined} valuation
 * @property {number[]|undefined} valuationHistory
 * @property {boolean|undefined} failed
 */

/**
 * @typedef {Object} State
 * @property {number} day
 * @property {number} money
 * @property {number} level
 * @property {number} xp
 * @property {string} currency
 * @property {number} heat
 * @property {Car[]} illegalMarket
 * @property {Car[]} garage
 * @property {number} garagesPurchased
 * @property {{legal: Record<string, number>, illegal: Record<string, number>}} partsPrices
 * @property {Record<string, number[]>} modelTrends
 * @property {{openCars: Record<string, boolean>, showDev: boolean, showOptions?: boolean}} ui
 * @property {{ modelImages: Record<string, string> }} assets
 * @property {string[]} log
 */

/**
 * @returns {State}
 */
export const defaultState = (options = {}) => {
  const difficulty = typeof options.difficulty === 'string' ? options.difficulty : 'standard';
  const currency = typeof options.currency === 'string' ? options.currency : 'USD';
  const startingMoneyUSD = (() => {
    switch (difficulty) {
      case 'easy': return 40000;
      case 'hard': return 12000;
      default: return 20000;
    }
  })();
  const rate = CURRENCY_RATES[currency] || 1;
  const startingMoney = Math.round(startingMoneyUSD * rate);
  const money = sanitizeMoney(options.money, startingMoney);
  const now = Date.now();
  const slot = typeof options.slot === 'number' ? options.slot : null;
  const aliasRaw = typeof options.alias === 'string' ? options.alias.trim() : '';
  const alias = aliasRaw ? aliasRaw.slice(0, 24) : 'Crew Chief';
  return {
    day: 1,
    money,
    level: 1,
    xp: 0,
    currency,
    heat: 0,
    illegalMarket: [],
    garage: [],
    garagesPurchased: 0,
    garageTier: 0,
    partsPrices: { legal: {}, illegal: {} },
    modelTrends: {},
    ui: { openCars: {}, showDev: false, tutorial: { completed: false, dismissedAt: 0 } },
    assets: { modelImages: {} },
    achievements: { unlocked: {}, progress: {} },
    crew: {
      heatSuppression: false,
      contrabandNetwork: false,
      pitCrew: false,
    },
    profile: {
      id: generateProfileId(),
      alias,
      shareLeaderboard: false,
    },
    log: [
      'Welcome to ICS. Buy, fix, flip, and race.',
      'Prices change daily. Illegal parts are cheaper, but sketchy...',
    ],
    league: {
      rank: 0,
      match: 0,
      history: [],
      completedRanks: [],
      champion: false,
      season: 1,
    },
    meta: {
      createdAt: now,
      lastPlayed: now,
      startingMoney: money,
      slot,
      difficulty,
    },
  };
};

let currentSlot = null;

export function getCurrentSlot() { return currentSlot; }

export function setCurrentSlot(slotIndex) {
  if (typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex < SAVE_SLOTS) {
    currentSlot = slotIndex;
    if (!state.meta || typeof state.meta !== 'object') state.meta = {};
    state.meta.slot = slotIndex;
  }
}

export function loadState(slotIndex = currentSlot) {
  if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex >= SAVE_SLOTS) return null;
  try {
    let raw = localStorage.getItem(toSlotKey(slotIndex));
    if (!raw && slotIndex === 0) {
      const legacy = localStorage.getItem('ics_state');
      if (legacy) {
        raw = legacy;
        localStorage.setItem(toSlotKey(0), legacy);
        localStorage.removeItem('ics_state');
      }
    }
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveState(slotIndex = currentSlot) {
  if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex >= SAVE_SLOTS) return;
  try {
    if (!state.meta || typeof state.meta !== 'object') state.meta = {};
    if (typeof state.meta.createdAt !== 'number') state.meta.createdAt = Date.now();
    state.meta.lastPlayed = Date.now();
    state.meta.slot = slotIndex;
    if (typeof state.meta.startingMoney !== 'number') state.meta.startingMoney = sanitizeMoney(state.money, 0);
    localStorage.setItem(toSlotKey(slotIndex), JSON.stringify(state));
  } catch {}
}

export function clearStateSlot(slotIndex) {
  if (typeof slotIndex !== 'number' || slotIndex < 0 || slotIndex >= SAVE_SLOTS) return;
  try { localStorage.removeItem(toSlotKey(slotIndex)); } catch {}
}

export function getSlotSummary(slotIndex) {
  const data = loadState(slotIndex);
  if (!data) return null;
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  return {
    slot: slotIndex,
    day: typeof data.day === 'number' && isFinite(data.day) ? Math.max(1, Math.round(data.day)) : 1,
    level: typeof data.level === 'number' && isFinite(data.level) ? Math.max(1, Math.round(data.level)) : 1,
    money: typeof data.money === 'number' && isFinite(data.money) ? Math.max(0, Math.round(data.money)) : 0,
    currency: typeof data.currency === 'string' ? data.currency : 'USD',
    lastPlayed: typeof meta.lastPlayed === 'number' ? meta.lastPlayed : null,
    createdAt: typeof meta.createdAt === 'number' ? meta.createdAt : null,
    startingMoney: typeof meta.startingMoney === 'number' ? Math.max(0, Math.round(meta.startingMoney)) : null,
    alias: data.profile && typeof data.profile.alias === 'string' ? data.profile.alias : 'Crew Chief',
    difficulty: typeof meta.difficulty === 'string' ? meta.difficulty : 'standard',
  };
}

export function migrateState() {
  try {
    if (!state || typeof state !== 'object') return;
    if (typeof state.day !== 'number' || !isFinite(state.day) || state.day < 1) state.day = 1;
    if (typeof state.money !== 'number' || !isFinite(state.money)) state.money = 20000;
    state.money = sanitizeMoney(state.money, 20000);
    if (typeof state.level !== 'number' || !isFinite(state.level)) state.level = 1;
    if (typeof state.xp !== 'number' || !isFinite(state.xp)) state.xp = 0;
    if (typeof state.garagesPurchased !== 'number' || !isFinite(state.garagesPurchased)) state.garagesPurchased = 0;
    if (typeof state.currency !== 'string') state.currency = 'USD';
    if (typeof state.heat !== 'number' || !isFinite(state.heat)) state.heat = 0;
    if (!state.modelTrends) state.modelTrends = {};
    if (!state.ui || typeof state.ui !== 'object') state.ui = { openCars: {}, showDev: false, tutorial: { completed: false, dismissedAt: 0 } };
    if (!state.ui.openCars) state.ui.openCars = {};
    if (typeof state.ui.showDev !== 'boolean') state.ui.showDev = false;
    if (!state.ui.tutorial || typeof state.ui.tutorial !== 'object') state.ui.tutorial = { completed: false, dismissedAt: 0 };
    if (typeof state.ui.tutorial.completed !== 'boolean') state.ui.tutorial.completed = false;
    if (typeof state.ui.tutorial.dismissedAt !== 'number') state.ui.tutorial.dismissedAt = 0;
    if (!state.achievements || typeof state.achievements !== 'object') state.achievements = { unlocked: {}, progress: {} };
    if (!state.achievements.unlocked || typeof state.achievements.unlocked !== 'object') state.achievements.unlocked = {};
    if (!state.achievements.progress || typeof state.achievements.progress !== 'object') state.achievements.progress = {};
    if (!state.crew || typeof state.crew !== 'object') {
      state.crew = { heatSuppression: false, contrabandNetwork: false, pitCrew: false };
    } else {
      if (typeof state.crew.heatSuppression !== 'boolean') state.crew.heatSuppression = false;
      if (typeof state.crew.contrabandNetwork !== 'boolean') state.crew.contrabandNetwork = false;
      if (typeof state.crew.pitCrew !== 'boolean') state.crew.pitCrew = false;
    }
    if (!state.profile || typeof state.profile !== 'object') {
      state.profile = { id: generateProfileId(), alias: 'Crew Chief', shareLeaderboard: false };
    } else {
      if (typeof state.profile.id !== 'string' || !state.profile.id) state.profile.id = generateProfileId();
      if (typeof state.profile.alias !== 'string' || !state.profile.alias.trim()) state.profile.alias = 'Crew Chief';
      state.profile.alias = state.profile.alias.slice(0, 24);
      if (typeof state.profile.shareLeaderboard !== 'boolean') state.profile.shareLeaderboard = false;
    }
    if (typeof state.garageTier !== 'number' || !isFinite(state.garageTier) || state.garageTier < 0) state.garageTier = 0;
    if (!state.assets || typeof state.assets !== 'object') state.assets = { modelImages: {} };
    if (!state.assets.modelImages) state.assets.modelImages = {};
    if (!state.partsPrices || typeof state.partsPrices !== 'object') state.partsPrices = { legal: {}, illegal: {} };
    if (!state.partsPrices.legal) state.partsPrices.legal = {};
    if (!state.partsPrices.illegal) state.partsPrices.illegal = {};
    if (!state.meta || typeof state.meta !== 'object') state.meta = { difficulty: 'standard' };
    if (typeof state.meta.difficulty !== 'string' || !['easy','standard','hard'].includes(state.meta.difficulty)) state.meta.difficulty = 'standard';
    const allowedModels = new Set(MODELS.map(m => m.model));
    const normalizeCar = (car) => {
      if (!car || !car.parts) return;
      if (typeof car.failed !== 'boolean') car.failed = false;
      for (const p of PARTS) {
        const v = car.parts[p.key];
        if (typeof v === 'boolean') car.parts[p.key] = v ? 100 : 0;
        else if (typeof v !== 'number' || !isFinite(v)) car.parts[p.key] = 100;
        else car.parts[p.key] = Math.max(0, Math.min(100, Math.round(v)));
      }
      if (typeof car.basePerf !== 'number' || !isFinite(car.basePerf)) car.basePerf = typeof car.perf === 'number' ? car.perf : 0;
      if (!car.tuning || typeof car.tuning !== 'object') car.tuning = {};
      for (const opt of TUNING_OPTIONS) {
        const level = clampTuningLevel(opt, car.tuning[opt.key] ?? 0);
        car.tuning[opt.key] = level;
      }
      const bonus = tuningBonus(car.tuning);
      car.perf = Math.round((car.basePerf ?? 0) + bonus);
      car.tuningBonus = bonus;
    };
    if (Array.isArray(state.garage)) {
      state.garage = state.garage.filter(car => {
        if (!allowedModels.has(car?.model)) return false;
        normalizeCar(car);
        return true;
      });
    }
    if (Array.isArray(state.illegalMarket)) {
      state.illegalMarket = state.illegalMarket.filter(car => {
        if (!allowedModels.has(car?.model)) return false;
        normalizeCar(car);
        return true;
      });
    }
    if (state.modelTrends && typeof state.modelTrends === 'object') {
      for (const key of Object.keys(state.modelTrends)) {
        if (!allowedModels.has(key)) delete state.modelTrends[key];
      }
    }
    if (!state.league || typeof state.league !== 'object') state.league = { rank: 0, match: 0, history: [], completedRanks: [], champion: false, season: 1 };
    if (typeof state.league.tier === 'number' && (state.league.rank === undefined || state.league.rank === null)) {
      state.league.rank = state.league.tier;
    }
    if ('tier' in state.league) delete state.league.tier;
    if (typeof state.league.rank !== 'number' || !isFinite(state.league.rank)) state.league.rank = 0;
    state.league.rank = Math.max(0, Math.min(LEAGUE_RANKS.length - 1, Math.round(state.league.rank)));
    if (typeof state.league.match !== 'number' || !isFinite(state.league.match)) state.league.match = 0;
    const rankOpponents = LEAGUE_RANKS[state.league.rank]?.opponents?.length ?? 0;
    state.league.match = Math.max(0, Math.min(rankOpponents, Math.round(state.league.match)));
    if (!Array.isArray(state.league.history)) state.league.history = [];
    if (!Array.isArray(state.league.completedRanks)) state.league.completedRanks = [];
    if (Array.isArray(state.league.completedTiers)) {
      state.league.completedRanks = Array.from(new Set([...(state.league.completedRanks || []), ...state.league.completedTiers]));
      delete state.league.completedTiers;
    }
    if (typeof state.league.champion !== 'boolean') state.league.champion = false;
    if (typeof state.league.season !== 'number' || !isFinite(state.league.season) || state.league.season < 1) state.league.season = 1;
    if (!state.meta || typeof state.meta !== 'object') state.meta = {};
    if (typeof state.meta.createdAt !== 'number') state.meta.createdAt = Date.now();
    if (typeof state.meta.lastPlayed !== 'number') state.meta.lastPlayed = Date.now();
    if (typeof state.meta.startingMoney !== 'number') state.meta.startingMoney = state.money;
    if (typeof state.meta.slot !== 'number' && typeof currentSlot === 'number') state.meta.slot = currentSlot;
  } catch {}
}

// Central state singleton
export let state = defaultState();
migrateState();

// Allow controlled reassignment from other modules
export function setState(next, slotIndex = currentSlot) {
  state = next;
  if (typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex < SAVE_SLOTS) currentSlot = slotIndex;
  migrateState();
  if (!state.meta || typeof state.meta !== 'object') state.meta = {};
  if (typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex < SAVE_SLOTS) state.meta.slot = slotIndex;
}

export function loadSlotIntoState(slotIndex) {
  const loaded = loadState(slotIndex);
  if (!loaded) return false;
  setState(loaded, slotIndex);
  return true;
}

export function createNewStateForSlot(slotIndex, options = {}) {
  const fresh = defaultState({ ...options, slot: slotIndex });
  setState(fresh, slotIndex);
  saveState(slotIndex);
  return state;
}

export function listSlotSummaries() {
  return Array.from({ length: SAVE_SLOTS }, (_, idx) => getSlotSummary(idx));
}

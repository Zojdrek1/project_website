// Race simulation utilities
// Self-contained: defines its own small helpers and imports data

import { PARTS, MODELS } from './data.js';

const rand = (min, max) => Math.random() * (max - min) + min;
const chance = (p) => Math.random() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

function avgConditionLocal(car) {
  return PARTS.reduce((a, p) => a + (car.parts[p.key] ?? 100), 0) / PARTS.length;
}

export function canRace(car) { return !car.failed; }

export function simulateRaceOutcome(car, opponentPerf) {
  const avg = avgConditionLocal(car);
  // Rating: use tuned perf plus light variance
  const myRating = (car.perf ?? 0);
  const oppRating = (opponentPerf ?? sample(MODELS).perf) + rand(-12, 12);
  // Logistic win chance based on rating difference
  const diff = myRating - oppRating;
  const winChance = clamp(1 / (1 + Math.exp(-diff / 36)), 0.12, 0.94);
  // Failure risk baseline even at 100%, increases with weak parts
  let failRisk = 0.02;
  let failedPart = null;
  // Dev tool: force part failure
  if (typeof window !== 'undefined' && window.__icsForcePartFailure) {
    window.__icsForcePartFailure = false;
    failedPart = sample(PARTS).key;
  } else {
    for (const p of PARTS) {
      const cond = car.parts[p.key] ?? 100;
      if (cond < 60) failRisk += (60 - cond) / 100 * 0.15;
      if (!failedPart && cond < 60 && chance((60 - cond) / 100 * 0.3)) failedPart = p.key;
    }
    if (!failedPart && chance(failRisk)) failedPart = sample(PARTS).key;
  }
  const win = !failedPart && chance(winChance);
  // House edge on odds: expected value slightly negative
  const margin = 0.12;
  const fairMult = 1 / winChance - 1; // net profit multiplier at fair odds
  const netProfitMult = Math.max(0, fairMult * (1 - margin));
  return { win, failedPart, winChance, netProfitMult };
}

export const RACE_EVENTS = [
    { id: 'local_meet', name: 'Local Meet', opponentPerf: 225, entryFee: 1200, prize: 3200, heat: 1, trackType: 'straight' },
    { id: 'warehouse_run', name: 'Warehouse Run', opponentPerf: 245, entryFee: 2400, prize: 6200, heat: 2, trackType: 'industrial' },
    { id: 'highway_pull', name: 'Highway Pull', opponentPerf: 270, entryFee: 4200, prize: 10400, heat: 4, trackType: 'highway' },
    { id: 'docks_sprint', name: 'Docks Sprint', opponentPerf: 295, entryFee: 6200, prize: 14800, heat: 6, trackType: 'industrial' },
    { id: 'mountain_pass', name: 'Mountain Pass Touge', opponentPerf: 320, entryFee: 9200, prize: 22000, heat: 8, trackType: 'mountain' },
    { id: 'midnight_grand_prix', name: 'Midnight Grand Prix', opponentPerf: 345, entryFee: 14000, prize: 32000, heat: 10, trackType: 'highway' },
];

export const LEAGUE_RANKS = [
  {
    id: 'rank_1_entry',
    name: 'Entry Racer',
    description: 'Neighbourhood touge and car-park sprints to break into the scene.',
    trophyReward: 15000,
    trophyXp: 40,
    heat: 3,
    opponents: [
      { name: 'Harajuku Night Class', perf: 220, reward: 5000, entryFee: 1200, xp: 16, heat: 2, trackType: 'straight' },
      { name: 'Osaka Clubline', perf: 230, reward: 6500, entryFee: 1600, xp: 18, heat: 2, trackType: 'industrial' },
      { name: 'Shibuya Beacon Crew', perf: 240, reward: 8200, entryFee: 2000, xp: 20, heat: 3, trackType: 'highway' },
    ],
  },
  {
    id: 'rank_2_paddock',
    name: 'Paddock Rookie',
    description: 'Small league showdowns with lightly tuned machines.',
    trophyReward: 22000,
    trophyXp: 55,
    heat: 3,
    opponents: [
      { name: 'Team Apex Idol', perf: 245, reward: 9000, entryFee: 2200, xp: 22, heat: 3, trackType: 'industrial' },
      { name: 'Kyoto Trialrunners', perf: 255, reward: 10800, entryFee: 2700, xp: 24, heat: 3, trackType: 'mountain' },
      { name: 'Yokohama Slipstream', perf: 265, reward: 12600, entryFee: 3200, xp: 26, heat: 3, trackType: 'straight' },
    ],
  },
  {
    id: 'rank_3_wangan',
    name: 'Wangan Wanderer',
    description: 'Long pulls and late-night highway duels on the Bayshore.',
    trophyReward: 28000,
    trophyXp: 65,
    heat: 4,
    opponents: [
      { name: 'Aqua-Line Phantoms', perf: 270, reward: 13500, entryFee: 3400, xp: 28, heat: 4, trackType: 'highway' },
      { name: 'Tsukuba Outrunners', perf: 280, reward: 15000, entryFee: 3800, xp: 30, heat: 4, trackType: 'industrial' },
      { name: 'Chiba Express', perf: 292, reward: 17000, entryFee: 4200, xp: 32, heat: 4, trackType: 'straight' },
    ],
  },
  {
    id: 'rank_4_touge',
    name: 'Touge Challenger',
    description: 'Mountain pass battles demanding grip, nerve, and setup.',
    trophyReward: 36000,
    trophyXp: 78,
    heat: 4,
    opponents: [
      { name: 'Mt. Myogi Alliance', perf: 300, reward: 19000, entryFee: 4800, xp: 36, heat: 4, trackType: 'mountain' },
      { name: 'Akagi Red Suns', perf: 308, reward: 21000, entryFee: 5200, xp: 38, heat: 4, trackType: 'mountain' },
      { name: 'Hakone Apex Pack', perf: 314, reward: 23500, entryFee: 5900, xp: 40, heat: 5, trackType: 'mountain' },
    ],
  },
  {
    id: 'rank_5_turbo',
    name: 'Turbo Outlaw',
    description: 'High-boost bruisers with attitude and noise complaints.',
    trophyReward: 44000,
    trophyXp: 92,
    heat: 5,
    opponents: [
      { name: 'Boost Junkies', perf: 320, reward: 26000, entryFee: 6500, xp: 42, heat: 5, trackType: 'industrial' },
      { name: 'Twin Scroll Syndicate', perf: 328, reward: 28000, entryFee: 7000, xp: 44, heat: 5, trackType: 'straight' },
      { name: 'Lag Killers Garage', perf: 334, reward: 30500, entryFee: 7600, xp: 46, heat: 5, trackType: 'highway' },
    ],
  },
  {
    id: 'rank_6_drift',
    name: 'Drift Virtuoso',
    description: 'Style meets speed on the judges’ switchbacks.',
    trophyReward: 52000,
    trophyXp: 108,
    heat: 5,
    opponents: [
      { name: 'Ebisu Slidehouse', perf: 336, reward: 33000, entryFee: 8200, xp: 48, heat: 5, trackType: 'mountain' },
      { name: 'Saitama Smoke Circle', perf: 342, reward: 35600, entryFee: 8900, xp: 50, heat: 5, trackType: 'industrial' },
      { name: 'Gunma Drift Union', perf: 346, reward: 38200, entryFee: 9600, xp: 52, heat: 5, trackType: 'mountain' },
    ],
  },
  {
    id: 'rank_7_apex',
    name: 'Apex Syndicate',
    description: 'Track-focused stables chasing the perfect exit line.',
    trophyReward: 64000,
    trophyXp: 126,
    heat: 6,
    opponents: [
      { name: 'Okayama Time Attack', perf: 348, reward: 41000, entryFee: 10200, xp: 54, heat: 6, trackType: 'industrial' },
      { name: 'Fuji Grip Society', perf: 352, reward: 43800, entryFee: 11000, xp: 56, heat: 6, trackType: 'straight' },
      { name: 'Suzuka Apex Union', perf: 356, reward: 46800, entryFee: 11700, xp: 58, heat: 6, trackType: 'mountain' },
    ],
  },
  {
    id: 'rank_8_shogun',
    name: 'Shogun Dominator',
    description: 'Elite teams with factory backing and media hype.',
    trophyReward: 76000,
    trophyXp: 145,
    heat: 6,
    opponents: [
      { name: 'Shogun R&D', perf: 360, reward: 49800, entryFee: 12400, xp: 60, heat: 6, trackType: 'industrial' },
      { name: 'Osaka Works Racing', perf: 364, reward: 53000, entryFee: 13200, xp: 62, heat: 6, trackType: 'highway' },
      { name: 'Kyushu Race Bureau', perf: 368, reward: 56200, entryFee: 14000, xp: 64, heat: 6, trackType: 'straight' },
    ],
  },
  {
    id: 'rank_9_midnight',
    name: 'Midnight Legend',
    description: 'Rumoured crews who own the Wangan after midnight.',
    trophyReward: 90000,
    trophyXp: 165,
    heat: 7,
    opponents: [
      { name: 'Bayshore Ghosts', perf: 372, reward: 59800, entryFee: 15000, xp: 66, heat: 7, trackType: 'highway' },
      { name: 'Expressway Dominion', perf: 376, reward: 63400, entryFee: 15800, xp: 68, heat: 7, trackType: 'straight' },
      { name: 'Shuto Midnight Circle', perf: 380, reward: 67200, entryFee: 16800, xp: 70, heat: 7, trackType: 'highway' },
    ],
  },
  {
    id: 'rank_10_king',
    name: 'Street King',
    description: 'The ultimate showdown. Beat the masters, claim the crown.',
    trophyReward: 120000,
    trophyXp: 200,
    heat: 8,
    opponents: [
      { name: 'Project Kaido', perf: 384, reward: 72000, entryFee: 18000, xp: 72, heat: 8, trackType: 'mountain' },
      { name: 'Emperor Works', perf: 388, reward: 76000, entryFee: 19000, xp: 74, heat: 8, trackType: 'industrial' },
      { name: 'Wangan Emissaries', perf: 392, reward: 82000, entryFee: 20500, xp: 80, heat: 8, trackType: 'highway' },
    ],
  },
];

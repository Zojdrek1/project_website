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
  // Rating: performance plus small condition bonus
  const myRating = car.perf + (avg - 60) * 0.3;
  const oppRating = (opponentPerf ?? sample(MODELS).perf) + rand(-6, 6);
  // Logistic win chance based on rating difference
  const diff = myRating - oppRating;
  const winChance = clamp(1 / (1 + Math.exp(-diff / 18)), 0.15, 0.9);
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
    { id: 'local_meet', name: 'Local Meet', opponentPerf: 55, entryFee: 500, prize: 1200, heat: 1, trackType: 'straight' },
    { id: 'warehouse_run', name: 'Warehouse Run', opponentPerf: 65, entryFee: 1000, prize: 2500, heat: 2, trackType: 'industrial' },
    { id: 'highway_pull', name: 'Highway Pull', opponentPerf: 78, entryFee: 2500, prize: 6000, heat: 4, trackType: 'highway' },
    { id: 'docks_sprint', name: 'Docks Sprint', opponentPerf: 85, entryFee: 5000, prize: 12000, heat: 6, trackType: 'industrial' },
    { id: 'mountain_pass', name: 'Mountain Pass Touge', opponentPerf: 92, entryFee: 10000, prize: 25000, heat: 8, trackType: 'mountain' },
    { id: 'midnight_grand_prix', name: 'Midnight Grand Prix', opponentPerf: 98, entryFee: 20000, prize: 50000, heat: 12, trackType: 'highway' },
];
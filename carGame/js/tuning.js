export const TUNING_OPTIONS = [
  {
    key: 'engine',
    name: 'Engine Mapping',
    icon: '⚙️',
    description: 'Adjust fuel and boost maps for more power.',
    stages: [
      { label: 'Stock', bonus: 0, cost: 0 },
      { label: 'Stage 1', bonus: 18, cost: 4500 },
      { label: 'Stage 2', bonus: 38, cost: 7800 },
      { label: 'Race Map', bonus: 62, cost: 11800 },
    ],
  },
  {
    key: 'suspension',
    name: 'Suspension Setup',
    icon: '🛞',
    description: 'Dial in spring rates and damping for better grip.',
    stages: [
      { label: 'Factory', bonus: 0, cost: 0 },
      { label: 'Street', bonus: 12, cost: 3600 },
      { label: 'Track', bonus: 26, cost: 6200 },
      { label: 'Competition', bonus: 40, cost: 8800 },
    ],
  },
  {
    key: 'aero',
    name: 'Aero Trim',
    icon: '🪶',
    description: 'Balance downforce and drag for better stability.',
    stages: [
      { label: 'Balanced', bonus: 0, cost: 0 },
      { label: 'Street Kit', bonus: 8, cost: 2800 },
      { label: 'Track Kit', bonus: 18, cost: 4800 },
      { label: 'Ground Effect', bonus: 30, cost: 7200 },
    ],
  },
];

export const TUNING_KEYS = TUNING_OPTIONS.map((opt) => opt.key);

export function clampTuningLevel(option, level) {
  const max = option.stages.length - 1;
  if (typeof level !== 'number' || !Number.isFinite(level)) return 0;
  if (level < 0) return 0;
  if (level > max) return max;
  return Math.round(level);
}

export function tuningStage(option, level) {
  const idx = clampTuningLevel(option, level);
  return option.stages[idx];
}

export function nextTuningStage(option, level) {
  const idx = clampTuningLevel(option, level);
  if (idx >= option.stages.length - 1) return null;
  return option.stages[idx + 1];
}

export function tuningBonus(tuning = {}) {
  let total = 0;
  for (const option of TUNING_OPTIONS) {
    const stage = tuningStage(option, tuning?.[option.key] ?? 0);
    total += stage.bonus || 0;
  }
  return total;
}

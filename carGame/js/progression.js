import { isAliasTaken } from './leaderboard.js';

export const GARAGE_TIERS = [
  {
    id: 'lockup',
    label: 'Back-Alley Lockup',
    description: 'Single bay storage with limited security. Starter tier included for free.',
    baseSlots: 1,
    unlockCost: 0,
    slotCostBase: 15000,
    slotCostScale: 1.6,
    maxExtraSlots: 2,
  },
  {
    id: 'warehouse',
    label: 'Industrial Warehouse',
    description: 'Secured multi-bay warehouse with loading dock access and better logistics.',
    baseSlots: 4,
    unlockCost: 125000,
    slotCostBase: 50000,
    slotCostScale: 1.55,
    maxExtraSlots: 4,
  },
  {
    id: 'compound',
    label: 'Underground Compound',
    description: 'Hidden facility with climate control and premium showcase bays.',
    baseSlots: 8,
    unlockCost: 325000,
    slotCostBase: 110000,
    slotCostScale: 1.5,
    maxExtraSlots: 6,
  },
  {
    id: 'skyVault',
    label: 'Skyline Vault',
    description: 'Ultra-secure penthouse garage reserved for elite crews.',
    baseSlots: 12,
    unlockCost: 600000,
    slotCostBase: 200000,
    slotCostScale: 1.45,
    maxExtraSlots: 6,
  },
];

export function getGarageTierConfig(tierIndex = 0) {
  if (typeof tierIndex !== 'number' || !Number.isFinite(tierIndex)) tierIndex = 0;
  const idx = Math.max(0, Math.min(GARAGE_TIERS.length - 1, Math.round(tierIndex)));
  return GARAGE_TIERS[idx];
}

export function garageTierBaseSlots(tierIndex = 0) {
  return getGarageTierConfig(tierIndex).baseSlots;
}

export function garageExtraSlotCost({ tierIndex = 0, slotsPurchased = 0 }) {
  const tier = getGarageTierConfig(tierIndex);
  const count = Math.max(0, slotsPurchased);
  const raw = tier.slotCostBase * Math.pow(tier.slotCostScale, count);
  return Math.round(raw / 500) * 500;
}

export function canPurchaseExtraSlot({ tierIndex = 0, slotsPurchased = 0 }) {
  const tier = getGarageTierConfig(tierIndex);
  return slotsPurchased < (tier.maxExtraSlots ?? 0);
}

export function canUnlockNextTier(tierIndex = 0) {
  return tierIndex < GARAGE_TIERS.length - 1;
}

export const COSMETIC_PACKAGES = [
  {
    id: 'wrap_midnight',
    label: 'Midnight Wrap',
    description: 'Deep midnight pearl wrap. Adds flair and resale interest.',
    cost: 18000,
    resaleBonus: 0.05,
    icon: '🖌️',
  },
  {
    id: 'aero_kit',
    label: 'Aero Kit',
    description: 'Wind-tunnel tuned aero package with functional lighting.',
    cost: 28000,
    resaleBonus: 0.07,
    icon: '🪛',
  },
  {
    id: 'interior_luxe',
    label: 'Luxe Interior',
    description: 'Hand-stitched leather interior and digital cluster upgrade.',
    cost: 36000,
    resaleBonus: 0.09,
    icon: '🛋️',
  },
  {
    id: 'heritage_badge',
    label: 'Heritage Badge',
    description: 'Certificate of authenticity and heritage detailing.',
    cost: 45000,
    resaleBonus: 0.12,
    icon: '🏅',
  },
];

export const CREW_INVESTMENTS = [
  {
    key: 'heatSuppression',
    label: 'Heat Suppression Unit',
    description: 'Reduces heat gain from jobs by 15%.',
    cost: 195000,
    icon: '🧯',
    effect: 'heatReduction',
  },
  {
    key: 'contrabandNetwork',
    label: 'Contraband Network',
    description: 'Secure contacts shave prices off illegal market listings.',
    cost: 235000,
    icon: '📦',
    effect: 'illegalDiscount',
  },
  {
    key: 'pitCrew',
    label: 'Elite Pit Crew',
    description: 'Lowers repair costs and improves race performance.',
    cost: 260000,
    icon: '🏎️',
    effect: 'repairBonus',
  },
];

export function getCosmeticById(id) {
  return COSMETIC_PACKAGES.find(c => c.id === id) || null;
}

export function getCrewInvestment(key) {
  return CREW_INVESTMENTS.find(c => c.key === key) || null;
}

export async function generateUniqueAlias() {
  const ADJECTIVES = ['Silent', 'Swift', 'Midnight', 'Apex', 'Rogue', 'Drift', 'Turbo', 'Nitro', 'Ghost', 'Shadow'];
  const NOUNS = ['Racer', 'Runner', 'King', 'Syndicate', 'Crew', 'Phantom', 'Joker', 'Outlaw', 'Spectre', 'Legend'];
  for (let i = 0; i < 20; i++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 90) + 10;
    const alias = `${adj} ${noun} ${num}`;
    // eslint-disable-next-line no-await-in-loop
    const taken = await isAliasTaken(alias);
    if (!taken) return alias;
  }
  return `Racer${Date.now() % 10000}`; // Fallback
}

export interface BossDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  color: string;
  targetMul?: number;
  throwsDelta?: number;
  rerollsDelta?: number;
  cupDelta?: number;
  /** Faces that don't score (no pips, no mods). */
  debuff?: number[];
}

const list: BossDef[] = [
  { id: 'pinch', name: 'The Pinch', icon: '🤏', desc: 'Throw 1 fewer die', color: '#f20884', cupDelta: -1, targetMul: 0.85 },
  { id: 'cooler', name: 'The Cooler', icon: '🧊', desc: '2 fewer Rerolls', color: '#02abea', rerollsDelta: -2 },
  { id: 'eye', name: 'Eye in the Sky', icon: '👁️', desc: 'Each hand scores only once', color: '#4700a5' },
  { id: 'shaver', name: 'The Shaver', icon: '🪒', desc: 'Hands have half their base Chips and Mult', color: '#808080', targetMul: 0.85 },
  { id: 'short_stack', name: 'The Short Stack', icon: '🥞', desc: '1 fewer Throw', color: '#ff6403', throwsDelta: -1 },
  { id: 'wall', name: 'The Wall', icon: '🧱', desc: 'Target is doubled', color: '#90713a', targetMul: 2 },
  { id: 'taxman', name: 'The Taxman', icon: '🧾', desc: 'Every Reroll costs $1', color: '#1fb714' },
  { id: 'scorpion', name: 'The Scorpion', icon: '🦂', desc: "1s and 2s don't score", color: '#dd0806', debuff: [1, 2] },
  { id: 'ceiling', name: 'The Ceiling', icon: '🏢', desc: "6s don't score", color: '#0000d4', debuff: [6] },
  { id: 'house_dice', name: 'House Dice', icon: '🎲', desc: 'All dice roll as plain 1-6', color: '#dd0806' },
  { id: 'iron_hand', name: 'The Iron Hand', icon: '🦾', desc: 'Only your first scored hand type counts. +1 Throw', color: '#404040', throwsDelta: 1 },
  { id: 'tilt', name: 'The Tilt', icon: '📐', desc: 'Every Reroll also rerolls one of your held dice', color: '#fcf305' },
  { id: 'arm', name: 'The Arm', icon: '💪', desc: 'Scoring a hand lowers its level by 1', color: '#ff6403' },
];

export const BOSSES: Record<string, BossDef> = Object.fromEntries(list.map((b) => [b.id, b]));
export const BOSS_IDS = list.map((b) => b.id);

export const FINAL_BOSS: BossDef = {
  id: 'house',
  name: 'The House',
  icon: '🏛️',
  desc: 'Two rules at once. The house always wins.',
  color: '#fcf305',
  targetMul: 1.5,
};

// Rules that make the final boss unfair when combined.
export const FINAL_EXCLUDE = ['wall', 'short_stack', 'iron_hand'];
// Rules that hard-counter a starting Cup in the first antes.
export const EARLY_EXCLUDE = ['wall', 'house_dice', 'iron_hand', 'arm'];

// Scout, the ValueScout Show-me mascot: the ValueScout mark (a diamond over stacked layers) as a
// character, drawn in a 160 × 120 box so it fits Mimik's 4:3 mascot slots.

export const SCOUT_VIEW_BOX = '0 0 160 120';
export const SCOUT_ASPECT = 120 / 160;

export const SCOUT_HEAD = 'M80 6 L134 34 L80 62 L26 34 Z';
export const SCOUT_LAYERS = ['M26 59 L80 87 L134 59', 'M26 77 L80 105 L134 77'];
export const SCOUT_EYE_ORIGIN = '80px 32px';

export const SCOUT_FACES = {
  happy: {
    eyes: ['M60 34 Q66 26 72 34', 'M88 34 Q94 26 100 34'],
    mouth: 'M72 44 Q80 50 88 44',
  },
  // Glancing up and aside with a small "oh": curious, not sad.
  lookaway: {
    pupils: [
      { cx: 73, cy: 31, r: 4 },
      { cx: 101, cy: 31, r: 4 },
    ],
    mouth: 'M85 43 a3 3 0 1 0 0.01 0',
  },
} as const;

export type ScoutPose = keyof typeof SCOUT_FACES;

export const SCOUT_COLOR = { head: '#B4461B', layers: '#463E38', face: '#FDF8F4', flash: '#FDE9C8' } as const;

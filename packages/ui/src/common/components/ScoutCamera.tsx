import { SCOUT_COLOR } from '../lib/scout-shapes';
import { ScoutFigure } from './ScoutFigure';

const FLASH = {
  loop: 'animate-[cam-flash_3s_ease_infinite] motion-reduce:animate-none',
  off: 'opacity-0',
  shutter: 'opacity-0 animate-[shutter_0.4s_ease-out] motion-reduce:animate-none',
} as const;

/** Scout holding a camera, for recording; the flash fires on a loop or once per shot. */
export function ScoutCamera({ size = 64, flash = 'loop' }: { size?: number; flash?: keyof typeof FLASH }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} fill="none" aria-hidden="true">
      <g transform="translate(20 30)">
        <ScoutFigure />
      </g>
      <rect x="62" y="104" width="76" height="46" rx="9" fill={SCOUT_COLOR.layers} />
      <circle cx="100" cy="127" r="15" fill={SCOUT_COLOR.face} />
      <circle cx="100" cy="127" r="8" fill={SCOUT_COLOR.head} />
      <circle cx="96" cy="123" r="3" fill={SCOUT_COLOR.face} opacity={0.8} />
      <rect x="122" y="100" width="16" height="8" rx="3" fill={SCOUT_COLOR.layers} />
      <circle cx="132" cy="100" r="13" fill={SCOUT_COLOR.flash} className={FLASH[flash]} />
      <ellipse cx="58" cy="128" rx="9" ry="8" fill={SCOUT_COLOR.head} />
      <ellipse cx="142" cy="128" rx="9" ry="8" fill={SCOUT_COLOR.head} />
    </svg>
  );
}

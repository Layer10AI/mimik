import { SCOUT_ASPECT, SCOUT_VIEW_BOX, type ScoutPose } from '../lib/scout-shapes';
import { ScoutFigure } from './ScoutFigure';

interface ScoutMascotProps {
  size?: number;
  pose?: ScoutPose;
  tone?: 'brand' | 'muted';
  /** Bob and ripple, for places where the mascot is the main thing on screen. */
  lively?: boolean;
}

/** Scout, the ValueScout Show-me mascot; it takes Mimik's mascot slots in the store build. */
export function ScoutMascot({ size = 22, pose = 'happy', tone = 'brand', lively = false }: ScoutMascotProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={SCOUT_VIEW_BOX}
      width={size}
      height={Math.round(size * SCOUT_ASPECT)}
      className={`block shrink-0 overflow-visible ${lively ? 'animate-[bob_2.6s_ease-in-out_infinite] motion-reduce:animate-none' : ''}`}
      aria-hidden="true"
    >
      <ScoutFigure pose={pose} tone={tone} lively={lively} />
    </svg>
  );
}

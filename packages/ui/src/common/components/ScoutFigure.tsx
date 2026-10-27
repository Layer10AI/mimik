import {
  SCOUT_COLOR,
  SCOUT_EYE_ORIGIN,
  SCOUT_FACES,
  SCOUT_HEAD,
  SCOUT_LAYERS,
  type ScoutPose,
} from '../lib/scout-shapes';

const still = 'motion-reduce:animate-none';

/**
 * Scout's shapes, for placing inside an svg with SCOUT_VIEW_BOX coordinates. It always blinks;
 * `lively` also ripples its layers. Keyframes are in global.css.
 */
export function ScoutFigure({
  pose = 'happy',
  tone = 'brand',
  lively = false,
}: {
  pose?: ScoutPose;
  tone?: 'brand' | 'muted';
  lively?: boolean;
}) {
  const muted = tone === 'muted';
  const head = muted ? 'currentColor' : SCOUT_COLOR.head;
  const layers = muted ? 'currentColor' : SCOUT_COLOR.layers;
  const face = SCOUT_FACES[pose];
  return (
    <>
      {SCOUT_LAYERS.map((d, index) => (
        <path
          key={d}
          d={d}
          stroke={layers}
          strokeOpacity={muted ? 0.45 : 1}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className={lively ? `animate-[scout-ripple_2.6s_ease-in-out_infinite] ${still}` : undefined}
          style={lively ? { animationDelay: `${index * 0.18}s` } : undefined}
        />
      ))}
      <path
        d={SCOUT_HEAD}
        fill={head}
        fillOpacity={muted ? 0.6 : 1}
        stroke={head}
        strokeOpacity={muted ? 0.6 : 1}
        strokeWidth={10}
        strokeLinejoin="round"
      />
      <g
        className={`animate-[scout-blink_4.5s_ease-in-out_infinite] ${still}`}
        style={{ transformOrigin: SCOUT_EYE_ORIGIN }}
      >
        {'pupils' in face
          ? face.pupils.map((pupil) => <circle key={pupil.cx} {...pupil} fill={SCOUT_COLOR.face} />)
          : face.eyes.map((d) => (
              <path key={d} d={d} stroke={SCOUT_COLOR.face} strokeWidth={5} strokeLinecap="round" fill="none" />
            ))}
      </g>
      <path d={face.mouth} stroke={SCOUT_COLOR.face} strokeWidth={3.5} strokeLinecap="round" fill="none" />
    </>
  );
}

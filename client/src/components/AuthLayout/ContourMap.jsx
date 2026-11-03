/**
 * The contour lines behind the brand panel, drawn around the hut (the red dot).
 */
import styles from './AuthLayout.module.css';

const WIDTH = 520;
const HEIGHT = 828;
const HUT = { x: 430, y: 612 };

// One closed, wobbly ring per altitude line.
const ring = (index) => {
  const radius = 28 + index * 42;
  const points = [];
  for (let step = 0; step <= 72; step += 1) {
    const angle = (step / 72) * 2 * Math.PI;
    const wobble =
      1 + 0.22 * Math.sin(2 * angle + index * 0.35) + 0.08 * Math.sin(3 * angle + 1 + index * 0.2);
    const x = HUT.x + radius * wobble * 1.35 * Math.cos(angle);
    const y = HUT.y + radius * wobble * Math.sin(angle);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${points.join(' L')} Z`;
};

const RINGS = Array.from({ length: 18 }, (_, index) => ring(index));

export function ContourMap() {
  return (
    <svg
      className={styles.contours}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {RINGS.map((path) => (
        <path key={path} d={path} />
      ))}
      <circle className={styles.hutHalo} cx={HUT.x} cy={HUT.y} r="12" />
      <circle className={styles.hutDot} cx={HUT.x} cy={HUT.y} r="5" />
    </svg>
  );
}

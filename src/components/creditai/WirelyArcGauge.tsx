/** Semicircular arc gauge — Wirely spec: track rgba(180,200,230,0.3), fill #5B87B7 */

type Props = {
  percent: number;
};

const R = 52;
const CX = 60;
const CY = 58;
/* Semicircle from left to right, sweep upward */
const d = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
const halfLen = Math.PI * R;

export function WirelyArcGauge({ percent }: Props) {
  const p = Math.max(0, Math.min(100, percent));
  const dash = (p / 100) * halfLen;

  return (
    <svg className="wirely-arc__svg" viewBox="0 0 120 78" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="rgba(180,200,230,0.35)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke="#5B87B7"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${halfLen}`}
      />
    </svg>
  );
}

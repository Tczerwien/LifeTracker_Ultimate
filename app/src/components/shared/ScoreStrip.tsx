import { scoreColor } from '../../lib/score-utils';
import { STREAK_GOLD } from '../../lib/constants';

interface ScoreStripProps {
  finalScore: number;
  baseScore: number;
  streak: number;
  positiveScore: number;
  vicePenalty: number;
}

interface KpiCellProps {
  label: string;
  value: string;
  color: string;
}

function KpiCell({ label, value, color }: KpiCellProps) {
  return (
    <div className="text-center">
      <div className="text-kpi-value" style={{ color }}>
        {value}
      </div>
      <div className="text-kpi-label text-gray-500">{label}</div>
    </div>
  );
}

export default function ScoreStrip({
  finalScore,
  baseScore,
  streak,
  positiveScore,
  vicePenalty,
}: ScoreStripProps) {
  const streakColor =
    streak >= 7 ? STREAK_GOLD : scoreColor(Math.min(streak / 7, 1));

  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-kpi p-component">
      <KpiCell
        label="Final Score"
        value={finalScore.toFixed(2)}
        color={scoreColor(finalScore)}
      />
      <KpiCell
        label="Base Score"
        value={baseScore.toFixed(2)}
        color={scoreColor(baseScore)}
      />
      <KpiCell
        label="Streak"
        value={`\u{1F525} ${streak} days`}
        color={streakColor}
      />
      <KpiCell
        label="Positive %"
        value={`${Math.round(positiveScore * 100)}%`}
        color={scoreColor(positiveScore)}
      />
      <KpiCell
        label="Vice %"
        value={`${Math.round(vicePenalty * 100)}%`}
        color={scoreColor(1 - vicePenalty)}
      />
    </div>
  );
}

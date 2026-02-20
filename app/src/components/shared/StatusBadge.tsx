import { ApplicationStatus } from '../../types/enums';
import { APPLICATION_STATUS_DISPLAY } from '../../lib/constants';

interface StatusBadgeProps {
  status: ApplicationStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const display = APPLICATION_STATUS_DISPLAY[status];

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${display.color}20`,
        color: display.color,
      }}
    >
      <span
        className="mr-1.5 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: display.color }}
      />
      {display.label}
    </span>
  );
}

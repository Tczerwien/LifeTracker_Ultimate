import type { Journal } from '../../types/models';
import DateNavigator from '../shared/DateNavigator';
import JournalForm from './JournalForm';

interface JournalShellProps {
  date: string;
  journal: Journal | null;
}

export default function JournalShell({ date, journal }: JournalShellProps) {
  return (
    <div className="p-section">
      <DateNavigator readOnly />
      <JournalForm date={date} journal={journal} />
    </div>
  );
}

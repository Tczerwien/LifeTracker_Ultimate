interface EmptyStateCardProps {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyStateCard({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateCardProps) {
  return (
    <div className="rounded-lg bg-surface-kpi p-section text-center">
      <div className="mb-3 text-3xl">{icon}</div>
      <h3 className="text-section-header font-semibold text-surface-dark">
        {title}
      </h3>
      <p className="mt-1 text-body text-gray-500">{message}</p>
      {onAction != null && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-md bg-productivity px-4 py-2 text-body font-medium text-white hover:bg-blue-600"
        >
          {actionLabel ?? 'Retry'}
        </button>
      )}
    </div>
  );
}

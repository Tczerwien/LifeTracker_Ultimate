interface EmptyStateCardProps {
  icon: string;
  title: string;
  message: string;
}

export default function EmptyStateCard({
  icon,
  title,
  message,
}: EmptyStateCardProps) {
  return (
    <div className="rounded-lg bg-surface-kpi p-section text-center">
      <div className="mb-3 text-3xl">{icon}</div>
      <h3 className="text-section-header font-semibold text-surface-dark">
        {title}
      </h3>
      <p className="mt-1 text-body text-gray-500">{message}</p>
    </div>
  );
}

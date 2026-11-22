import { StatusBadge } from './StatusBadge';

export const AllStatuses = () => (
  <p style={{ display: 'flex', gap: 8 }}>
    <StatusBadge status="passed" />
    <StatusBadge status="failed" />
    <StatusBadge status="flaky" />
    <StatusBadge status="skipped" />
  </p>
);

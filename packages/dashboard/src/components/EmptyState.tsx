import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="aiqa-empty" role="status">
      <p className="aiqa-empty__title">{title}</p>
      {children ? <div className="aiqa-empty__body">{children}</div> : null}
    </div>
  );
}

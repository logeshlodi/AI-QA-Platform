import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@aiqa/dashboard/src/styles.css';

export const metadata: Metadata = {
  title: { default: 'AI-QA Platform', template: '%s · AI-QA Platform' },
  description: 'Run history, trends, flaky tests, heal audit and agent runs',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

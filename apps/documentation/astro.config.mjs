// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

// GitHub Pages serves the site under the repository name; locally it is at the root.
const base = process.env.DOCS_BASE ?? '/';
const REPO = 'https://github.com/logeshlodi/AI-QA-Platform';

export default defineConfig({
  site: process.env.DOCS_SITE ?? 'https://logeshlodi.github.io',
  base,
  integrations: [
    starlight({
      title: 'AI-QA Platform',
      description:
        'An enterprise Playwright and TypeScript platform with self-healing, AI agents and a learning path.',
      social: [{ icon: 'github', label: 'GitHub', href: REPO }],
      editLink: { baseUrl: `${REPO}/edit/main/docs/` },
      lastUpdated: false,
      sidebar: [
        { label: 'Start here', link: '/' },
        { label: 'Learning path', items: [{ autogenerate: { directory: 'learning' } }] },
        { label: 'Architecture', link: '/architecture/' },
        { label: 'Decisions (ADRs)', items: [{ autogenerate: { directory: 'adr' } }] },
        { label: 'Coverage matrix', link: '/coverage-matrix/' },
        { label: 'Agents vs Playwright', link: '/agents-vs-playwright/' },
        { label: 'Status', link: '/status/' },
      ],
    }),
  ],
});

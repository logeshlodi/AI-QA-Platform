/**
 * The story gallery Playwright's built-in `mount` fixture drives (Playwright 1.62+ component
 * testing). It implements the gallery contract: window.mount({ story, props }) renders one story
 * into #root and rejects on failure; window.unmount() clears it. Opened in a browser with no story
 * mounted, it lists every story as a link (?story=<id>) so the gallery doubles as a catalogue.
 */
import { StrictMode, type ComponentType } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/styles.css';

type StoryModule = Record<string, ComponentType<Record<string, unknown>>>;

const stories = import.meta.glob<StoryModule>('../../src/**/*.story.tsx');
// ../../src/components/RunTable.story.tsx -> components/RunTable
const pathOf = (file: string) => file.replace(/^(\.\.\/)+src\//, '').replace(/\.story\.tsx$/, '');

async function resolve(storyId: string) {
  const sep = storyId.lastIndexOf('/');
  const [path, name] = [storyId.slice(0, sep), storyId.slice(sep + 1)];
  const file = Object.keys(stories).find((f) => pathOf(f) === path || pathOf(f).endsWith(`/${path}`));
  const mod = file ? await stories[file]!() : undefined;
  return mod?.[name];
}

const rootEl = document.getElementById('root')!;
let root: Root | undefined;

async function mount({ story, props }: { story: string; props?: Record<string, unknown> }) {
  const Story = await resolve(story);
  if (!Story) throw new Error(`Unknown story: ${story}`);
  root ??= createRoot(rootEl); // reused, so component.update(props) keeps component state
  // flushSync: a render error rejects this promise instead of being swallowed.
  flushSync(() =>
    root!.render(
      <StrictMode>
        <Story {...props} />
      </StrictMode>,
    ),
  );
}

async function unmount() {
  root?.unmount();
  root = undefined;
}

Object.assign(window, { mount, unmount });

// Browsing by hand: ?story=components/RunTable/Recent mounts one; no parameter lists them all.
const requested = new URLSearchParams(location.search).get('story');
if (requested) void mount({ story: requested });
else if (!navigator.webdriver) {
  void (async () => {
    const ids: string[] = [];
    for (const [file, load] of Object.entries(stories))
      for (const name of Object.keys(await load())) ids.push(`${pathOf(file)}/${name}`);
    rootEl.innerHTML = `<main style="padding:24px;font-family:system-ui"><h1>Stories</h1><ul>${ids
      .sort()
      .map((id) => `<li><a href="?story=${encodeURIComponent(id)}">${id}</a></li>`)
      .join('')}</ul></main>`;
  })();
}

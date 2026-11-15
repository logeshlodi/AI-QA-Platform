import type { ElementDescriptor } from '@aiqa/self-healing-engine';

export interface ProbeArgs {
  limit: number;
}

/**
 * Runs INSIDE the browser. Describes one element (when called through
 * locator.evaluate) or every interesting visible element (through page.evaluate).
 * One function serves both so a fingerprint and a candidate are always
 * described by exactly the same code. It must stay self-contained: no imports,
 * no outer variables.
 */
export function probe(first: Element | ProbeArgs, second?: ProbeArgs): ElementDescriptor[] {
  const single = first instanceof Element ? first : undefined;
  const limit = (single ? second?.limit : (first as ProbeArgs).limit) ?? 400;

  const clean = (s: string | null | undefined, max: number) =>
    (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

  const roleOf = (el: Element): string => {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a' && el.hasAttribute('href')) return 'link';
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'img') return 'img';
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'input') {
      const type = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (['button', 'submit', 'reset'].includes(type)) return 'button';
      if (type === 'checkbox' || type === 'radio') return type;
      if (['text', 'email', 'password', 'search', 'tel', 'url', 'number'].includes(type)) return 'textbox';
    }
    return '';
  };

  const nameOf = (el: Element): string => {
    const aria = clean(el.getAttribute('aria-label'), 120);
    if (aria) return aria;
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const joined = clean(
        labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' '),
        120,
      );
      if (joined) return joined;
    }
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
    ) {
      const label = clean(el.labels?.[0]?.textContent, 120);
      if (label) return label;
      if (el instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(el.type))
        return clean(el.value, 120);
      return clean(el.getAttribute('placeholder') ?? el.getAttribute('title'), 120);
    }
    if (el instanceof HTMLImageElement) return clean(el.alt, 120);
    return (
      clean((el as HTMLElement).innerText ?? el.textContent, 120) || clean(el.getAttribute('title'), 120)
    );
  };

  const chain = (el: Element): Element[] => {
    const nodes: Element[] = [];
    for (let node: Element | null = el; node && node !== document.documentElement; node = node.parentElement)
      nodes.unshift(node);
    return nodes;
  };

  const cssPath = (el: Element): string =>
    ['html']
      .concat(
        chain(el).map((node) => {
          const tag = node.tagName.toLowerCase();
          const twins = Array.from(node.parentElement?.children ?? []).filter(
            (c) => c.tagName === node.tagName,
          );
          return twins.length > 1 ? `${tag}:nth-of-type(${twins.indexOf(node) + 1})` : tag;
        }),
      )
      .join(' > ');

  // Text of the nearest ancestor that says more than the element itself: its card, row or form.
  const contextOf = (el: Element): string => {
    const own = clean((el as HTMLElement).innerText ?? el.textContent, 400);
    let node = el.parentElement;
    for (let depth = 0; node && node !== document.body && depth < 4; depth++, node = node.parentElement) {
      const around = clean(node.innerText ?? node.textContent, 400);
      if (around.length > own.length + 3) return around.slice(0, 160);
    }
    return '';
  };

  const describe = (el: Element): ElementDescriptor => {
    const attributes: Record<string, string> = {};
    for (const key of ['id', 'class', 'name', 'type', 'href', 'placeholder']) {
      const value = el.getAttribute(key);
      if (value) attributes[key] = value;
    }
    const isField =
      el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
    return {
      tag: el.tagName.toLowerCase(),
      role: roleOf(el),
      accessibleName: nameOf(el),
      text: isField ? '' : clean((el as HTMLElement).innerText ?? el.textContent, 160),
      testId:
        el.getAttribute('data-testid') ??
        el.getAttribute('data-test') ??
        el.getAttribute('data-test-id') ??
        '',
      attributes,
      ancestorPath: chain(el)
        .map((n) => n.tagName.toLowerCase())
        .join('>'),
      cssPath: cssPath(el),
      context: contextOf(el),
    };
  };

  if (single) return [describe(single)];

  const interesting =
    'a[href],button,input,select,textarea,summary,[role],[data-testid],[data-test],[data-test-id],[onclick],label,img,h1,h2,h3,h4,h5,h6';
  return Array.from(document.querySelectorAll(interesting))
    .filter((el) => el.getClientRects().length > 0)
    .slice(0, limit)
    .map(describe);
}

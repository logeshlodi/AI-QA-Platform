import { XMLParser } from 'fast-xml-parser';

/** One view in Android's UI tree (Appium's page source), with the attributes the framework reads. */
export interface UiNode {
  class: string;
  resourceId: string;
  text: string;
  contentDesc: string;
  clickable: boolean;
  displayed: boolean;
  enabled: boolean;
  bounds: [number, number, number, number];
  /** Class names from the root down to this node's parent. */
  path: string[];
  children: UiNode[];
}

/** Android's page source: one element per view, named by class, attributes on each. */
export function parseUiTree(xml: string): UiNode {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    preserveOrder: true,
    parseAttributeValue: false,
  });
  type Raw = Record<string, Raw[]> & { ':@'?: Record<string, string> };
  const toNode = (raw: Raw, path: string[]): UiNode => {
    const tag = Object.keys(raw).find((k) => k !== ':@') ?? 'node';
    const a = raw[':@'] ?? {};
    const box = (a.bounds ?? '[0,0][0,0]').match(/-?\d+/g)?.map(Number) ?? [0, 0, 0, 0];
    const cls = a.class ?? tag;
    return {
      class: cls,
      resourceId: a['resource-id'] ?? '',
      text: a.text ?? '',
      contentDesc: a['content-desc'] ?? '',
      clickable: a.clickable === 'true' || a['long-clickable'] === 'true',
      displayed: a.displayed !== 'false',
      enabled: a.enabled !== 'false',
      bounds: [box[0] ?? 0, box[1] ?? 0, box[2] ?? 0, box[3] ?? 0],
      path,
      children: (raw[tag] ?? []).filter((c) => !('#text' in c)).map((c) => toNode(c, [...path, cls])),
    };
  };
  const top = (parser.parse(xml) as Raw[]).filter((r) => !('?xml' in r));
  return {
    class: 'root',
    resourceId: '',
    text: '',
    contentDesc: '',
    clickable: false,
    displayed: true,
    enabled: true,
    bounds: [0, 0, 0, 0],
    path: [],
    children: top.map((t) => toNode(t, [])),
  };
}

/** Every node in the tree, depth first. */
export function allNodes(root: UiNode): UiNode[] {
  return [root, ...root.children.flatMap(allNodes)];
}

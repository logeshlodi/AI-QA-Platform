import type { ElementDescriptor } from './types';

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * The locator a person should paste in, best practice first:
 * test id, then role and accessible name, then text, then CSS as a last resort.
 */
export function suggestLocator(element: ElementDescriptor): string {
  if (element.testId) return `page.getByTestId(${quote(element.testId)})`;
  if (element.role && element.accessibleName) {
    return `page.getByRole(${quote(element.role)}, { name: ${quote(element.accessibleName)} })`;
  }
  if (element.text && element.text.length <= 60)
    return `page.getByText(${quote(element.text)}, { exact: true })`;
  return `page.locator(${quote(element.cssPath)})`;
}

/** Small display helpers shared by the components. */

export const WIKI = 'https://fi.wikipedia.org/w/index.php';

export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function formatDateTime(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function formatBytes(n: number): string {
  return `${n.toLocaleString('en-US')} bytes`;
}

export function revisionUrl(revId: number): string {
  return `${WIKI}?oldid=${revId}`;
}

export function diffUrl(revId: number, parentId: number | null): string {
  return parentId ? `${WIKI}?diff=${revId}&oldid=${parentId}` : revisionUrl(revId);
}

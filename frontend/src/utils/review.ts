import type { Change, Severity } from '../types';

const SEVERITY_ORDER: Severity[] = ['high', 'medium', 'low', 'none'];

const ANONYMOUS_PREFIX = 'anon:'; // the server's pseudonym for an IP editor

export function isAnonymous(user: string): boolean {
  return user.startsWith(ANONYMOUS_PREFIX);
}

/** IP editors are shown as `anonymous`, the translated label. */
export function editorName(user: string, anonymous: string): string {
  return isAnonymous(user) ? anonymous : user;
}

export function isFlagged(change: Change): boolean {
  return change.flags.length > 0 || change.neutrality === 'less_neutral';
}

/** Revisions with at least one flagged passage; a long edit is split into several passages. */
export function flaggedEditCount(changes: Change[]): number {
  return new Set(changes.filter(isFlagged).map((change) => change.revision?.id ?? `passage ${change.changeIndex}`)).size;
}

/** Count distinct suspicious revisions per known editor, most frequent first. */
export function flaggedEditors(changes: Change[]): { user: string; edits: number }[] {
  const revisions = new Map<string, Set<number>>();
  for (const change of changes) {
    const revision = change.revision;
    if (!isFlagged(change) || !revision?.user) continue;
    const edits = revisions.get(revision.user) ?? new Set<number>();
    edits.add(revision.id);
    revisions.set(revision.user, edits);
  }
  return [...revisions].map(([user, edits]) => ({ user, edits: edits.size }))
    .sort((a, b) => b.edits - a.edits || a.user.localeCompare(b.user));
}

/** Most severe first. */
export function bySeverity(a: Change, b: Change): number {
  return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
}

import type { Change, Severity } from '../types';

const SEVERITY_ORDER: Severity[] = ['high', 'medium', 'low', 'none'];

export function isFlagged(change: Change): boolean {
  return change.flags.length > 0 || change.neutrality === 'less_neutral';
}

/** Revisions with at least one flagged passage; a long edit is split into several passages. */
export function flaggedEditCount(changes: Change[]): number {
  return new Set(changes.filter(isFlagged).map((change) => change.revision?.id ?? `passage ${change.changeIndex}`)).size;
}

/** Most severe first. */
export function bySeverity(a: Change, b: Change): number {
  return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
}

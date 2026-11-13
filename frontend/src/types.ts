// Shapes of the data the backend returns. Keep in sync with server/index.ts.

export interface Change {
  kind: 'modified' | 'added' | 'removed';
  oldText: string | null;
  newText: string | null;
  /** Positive = wording became more positive, negative = more negative. */
  toneDelta: number;
  hedgeAdded: boolean;
}

export interface RevisionInfo {
  date: string; // YYYY-MM-DD
}

export interface Comparison {
  article: string;
  from: RevisionInfo | null; // null = no revision existed on that date
  to: RevisionInfo | null;
  changes: Change[];
}

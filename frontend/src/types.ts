/** Response types for the FastAPI article changes service. */
export interface PageSearchResult {
  page_id: number;
  title: string;
  n_versions: number;
}

export interface ArticlePage {
  n_versions: number;
  created: string;
  last_edit: string;
  url: string;
}

export interface RevisionPoint {
  rev_id: number;
  timestamp: string;
  title: string;
  bytes: number;
}

export interface WordChange {
  before: string;
  after: string;
  context: string;
}

export interface RevisionChange extends RevisionPoint {
  parent_id: number | null;
  user: string;
  anonymous: boolean;
  minor: boolean;
  comment: string;
  bytes_delta: number;
  is_new_page: boolean;
  is_revert: boolean;
  revert_to_rev_id: number | null;
  added: string[];
  removed: string[];
  word_changes: WordChange[];
  unified_diff: string;
}

export interface ChangeSummary {
  revisions: number;
  returned: number;
  editors: number;
  anonymous_edits: number;
  minor_edits: number;
  reverts: number;
  bytes_start: number | null;
  bytes_end: number | null;
}

export interface NetChange {
  added: string[];
  removed: string[];
  word_changes: WordChange[];
  unified_diff: string;
}

export interface ArticleChanges {
  page_id: number;
  title: string;
  page: ArticlePage;
  range: { start: string; end: string };
  baseline: RevisionPoint | null;
  final: RevisionPoint | null;
  summary: ChangeSummary;
  revisions: RevisionChange[];
  net_change: NetChange;
  truncated: boolean;
}

// UI-facing model retained for the current tone-summary components.
export interface Change {
  kind: 'modified' | 'added' | 'removed';
  oldText: string | null;
  newText: string | null;
  toneDelta: number;
  hedgeAdded: boolean;
}

export interface RevisionInfo {
  date: string;
}

export interface Comparison {
  article: string;
  from: RevisionInfo | null;
  to: RevisionInfo | null;
  changes: Change[];
}

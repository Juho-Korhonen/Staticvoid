// Shapes of the data the Python API (mariadb/server) returns. Keep in sync with
// server/changes.py and the "Response" section of server/README.md.

export interface PageMatch {
  page_id: number;
  title: string;
  n_versions: number;
}

export interface WordChange {
  before: string;
  after: string;
  /** Text around the edit; `[[CHANGE]]` marks where it happened. */
  context: string;
}

export interface Diff {
  added: string[];
  removed: string[];
  word_changes: WordChange[];
  unified_diff: string;
}

export interface RevisionBrief {
  rev_id: number;
  timestamp: string; // ISO, UTC
  title: string;
  bytes: number | null;
}

export interface Revision extends Diff {
  rev_id: number;
  parent_id: number | null;
  timestamp: string;
  title: string;
  user: string | null;
  anonymous: boolean;
  minor: boolean;
  comment: string | null;
  bytes: number | null;
  bytes_delta: number;
  is_new_page: boolean;
  is_revert: boolean;
  revert_to_rev_id: number | null;
}

export interface ChangesResponse {
  page_id: number;
  title: string | null;
  page: { n_versions: number; created: string; last_edit: string; url: string } | null;
  range: { start: string; end: string };
  /** Last version before `start`; null when the article was created inside the range. */
  baseline: RevisionBrief | null;
  /** Last version before `end`; null when the article did not exist yet. */
  final: RevisionBrief | null;
  summary: {
    revisions: number;
    returned: number;
    editors: number;
    anonymous_edits: number;
    minor_edits: number;
    reverts: number;
    bytes_start: number;
    bytes_end: number;
  };
  /** Oldest first, at most `max_revisions` (the newest ones). */
  revisions: Revision[];
  /** baseline → final */
  net_change: Diff;
  truncated: boolean;
}

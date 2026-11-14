/** Response types for the FastAPI article changes service. */
export interface PageSearchResult {
  page_id: number;
  title: string;
  n_versions: number;
}

// Gemini output from server/rhetoric.py, adapted for the UI by articleService.ts.

export type Neutrality = 'more_neutral' | 'less_neutral' | 'unchanged' | 'unclear';

export const neutralityLabels: Record<Neutrality | 'mixed', string> = {
  more_neutral: 'More objective',
  less_neutral: 'More rhetorical',
  unchanged: 'No clear shift in neutrality',
  unclear: 'Not enough context to judge',
  mixed: 'Mixed: objective and rhetorical changes',
};

export interface Sources {
  before: string | null;
  after: string | null;
  diff: string | null;
}

export const flagLabels = {
  possible_vandalism: 'Possible vandalism', loaded_language: 'Loaded language',
  framing_shift: 'Framing shift', unsupported_claim: 'Unsupported claim',
  source_removal: 'Source removal', content_removal: 'Selective deletion',
  undue_weight: 'Undue emphasis', attribution_change: 'Attribution change', certainty_shift: 'Changed certainty',
};

export interface AnalysisCoverage {
  reviewedChanges: number;
  totalChanges: number;
  totalBlocks: number;
  reviewedRevisions: number;
  totalRevisions: number;
  completedBatches: number;
  totalBatches: number;
}

export type AnalysisProgress = { stage: 'loading' | 'analyzing' } & Partial<AnalysisCoverage>;

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
  rhetoric_analysis?: Analysis;
}

// UI-facing model for the Gemini reading and quoted evidence.
export interface Change {
  kind: 'modified' | 'added' | 'removed';
  oldText: string | null;
  newText: string | null;
  toneDelta: number;
  hedgeAdded: boolean;
  neutrality: Neutrality;
  explanation: string;
  evidenceBefore: string | null;
  evidenceAfter: string | null;
  framingChanges: string[];
  neutralWording: string | null;
  textTruncated: boolean;
  flags: (keyof typeof flagLabels)[];
  severity: 'none' | 'low' | 'medium' | 'high';
  possibleAgenda: string | null;
  segmentIndex: number;
  segmentCount: number;
  revision?: { id: number; beforeId: number | null; timestamp: string; isRevert: boolean };
  sources?: Sources;
}

export interface Analysis {
  summary: string;
  overallNeutrality: Neutrality | 'mixed';
  possibleAgenda: string | null;
  model: string | null;
  partial: boolean;
  totalChanges: number;
  flaggedChanges: number;
  coverage: AnalysisCoverage;
  changes: Change[];
  sources: Sources;
}

export interface RevisionInfo {
  date: string;
  revId: number;
  title: string;
}

export interface Comparison {
  article: string;
  from: RevisionInfo | null;
  to: RevisionInfo | null;
  changes: Change[];
  analysis: Analysis;
  revisionCount: number;
  editorCount: number;
}

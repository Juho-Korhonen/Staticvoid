/** Types for the Python article changes service (server/), limited to what the UI reads. */

export interface PageSearchResult {
  page_id: number;
  title: string;
  n_versions: number;
}

export type Neutrality = 'more_neutral' | 'less_neutral' | 'unchanged' | 'unclear';
export type OverallNeutrality = Neutrality | 'mixed';
export type Severity = 'none' | 'low' | 'medium' | 'high';
export type ChangeCategory =
  | 'trolling' | 'vandalism' | 'rhetorical_change' | 'factual_update'
  | 'sourcing_change' | 'formatting' | 'repair' | 'unclear';
export type RhetoricalCategory =
  | 'loaded_language' | 'blame_or_credit' | 'downplaying_or_exaggeration'
  | 'selective_emphasis' | 'certainty_shift' | 'attribution_shift';
export type Flag =
  | 'possible_vandalism' | 'loaded_language' | 'framing_shift' | 'unsupported_claim' | 'source_removal'
  | 'content_removal' | 'undue_weight' | 'attribution_change' | 'certainty_shift';

export interface Sources {
  before: string | null;
  after: string | null;
  diff: string | null;
}

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

/** One reviewed passage of one revision, with Gemini's reading of it. */
export interface Change {
  changeIndex: number;
  category: ChangeCategory;
  rhetoricalCategory: RhetoricalCategory | null;
  kind: 'modified' | 'added' | 'removed';
  oldText: string | null;
  newText: string | null;
  toneDelta: number;
  hedgeAdded: boolean;
  neutrality: Neutrality;
  explanation: string;
  framingChanges: string[];
  flags: Flag[];
  severity: Severity;
  possibleAgenda: string | null;
  segmentIndex: number;
  segmentCount: number;
  revision?: { id: number; beforeId: number | null; timestamp: string; isRevert: boolean };
  sources?: Sources;
}

export interface Analysis {
  summary: string;
  overallNeutrality: OverallNeutrality;
  possibleAgenda: string | null;
  model: string | null;
  partial: boolean;
  totalChanges: number;
  flaggedChanges: number;
  coverage: AnalysisCoverage;
  changes: Change[];
  sources: Sources;
}

export interface RevisionPoint {
  rev_id: number;
  timestamp: string;
  title: string;
  bytes: number;
}

/** `/changes?analyze=true` response. */
export interface AnalyzedArticle {
  title: string;
  baseline: RevisionPoint | null;
  final: RevisionPoint | null;
  summary: { revisions: number; editors: number };
  rhetoric_analysis: Analysis;
}

// UI-facing model, adapted from AnalyzedArticle by articleService.ts.

export interface Comparison {
  analysis: Analysis;
  revisionCount: number;
  editorCount: number;
}

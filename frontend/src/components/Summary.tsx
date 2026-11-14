import { neutralityLabels } from '../labels';
import type { Comparison } from '../types';
import ExternalLink from './ExternalLink';

export default function Summary({ comparison }: { comparison: Comparison }) {
  const { analysis, revisionCount, editorCount } = comparison;
  const { coverage, sources } = analysis;

  return (
    <section className="reading" aria-label="Gemini reading">
      <p className="reading-label">{analysis.model ? 'Gemini’s review' : 'Revision comparison'} · Every saved edit in the period</p>
      <h2>{analysis.flaggedChanges > 0 ? `${analysis.flaggedChanges} passages flagged for review` : neutralityLabels[analysis.overallNeutrality]}</h2>
      <p>{analysis.summary}</p>
      <p><strong>Possible agenda (inferred):</strong> {analysis.possibleAgenda ?? 'No agenda was established from the inspected wording.'}</p>
      <p className="reading-note">
        Coverage: {coverage.reviewedRevisions}/{coverage.totalRevisions} saved revisions,{' '}
        {coverage.reviewedChanges}/{coverage.totalChanges} passages in {coverage.totalBlocks} change blocks.{' '}
        {coverage.completedBatches}/{coverage.totalBatches} batches completed.
      </p>
      <p className="reading-note">{revisionCount} revisions by {editorCount} editors. This describes the wording’s effect; it does not establish anyone’s intent.</p>
      <p className="reading-note">Reverted edits are included. Automated review can still miss subtle manipulation; flags are findings to verify.</p>
      <nav className="source-links" aria-label="Wikipedia sources">
        <span>Sources:</span>
        {sources.before && <ExternalLink href={sources.before}>Earlier revision</ExternalLink>}
        {sources.after && <ExternalLink href={sources.after}>Later revision</ExternalLink>}
        {sources.diff && <ExternalLink href={sources.diff}>Start-to-end diff ↗</ExternalLink>}
      </nav>
    </section>
  );
}

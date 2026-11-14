import { neutralityLabels, type Comparison } from '../types';

export default function Summary({ comparison }: { comparison: Comparison }) {
  const { analysis, revisionCount, editorCount } = comparison;

  return (
    <section className="reading" aria-label="Gemini reading">
      <p className="reading-label">{analysis.model ? 'Gemini’s review' : 'Revision comparison'} · Every saved edit in the period</p>
      <h2>{analysis.flaggedChanges > 0 ? `${analysis.flaggedChanges} passages flagged for review` : neutralityLabels[analysis.overallNeutrality]}</h2>
      <p>{analysis.summary}</p>
      <p><strong>Possible agenda (inferred):</strong> {analysis.possibleAgenda ?? 'No agenda was established from the inspected wording.'}</p>
      <p className="reading-note">Coverage: {analysis.coverage.reviewedRevisions}/{analysis.coverage.totalRevisions} saved revisions, {analysis.coverage.reviewedChanges}/{analysis.coverage.totalChanges} passages in {analysis.coverage.totalBlocks} change blocks. {analysis.coverage.completedBatches}/{analysis.coverage.totalBatches} batches completed.</p>
      <p className="reading-note">{revisionCount} revisions by {editorCount} editors. This describes the wording’s effect; it does not establish anyone’s intent.</p>
      <p className="reading-note">Reverted edits are included. Automated review can still miss subtle manipulation; flags are findings to verify.</p>
      <nav className="source-links" aria-label="Wikipedia sources">
        <span>Sources:</span>
        {analysis.sources.before && <a href={analysis.sources.before} target="_blank" rel="noreferrer">Earlier revision</a>}
        {analysis.sources.after && <a href={analysis.sources.after} target="_blank" rel="noreferrer">Later revision</a>}
        {analysis.sources.diff && <a href={analysis.sources.diff} target="_blank" rel="noreferrer">Start-to-end diff ↗</a>}
      </nav>
    </section>
  );
}

import { neutralityLabels } from '../labels';
import type { Comparison } from '../types';
import ExternalLink from './ExternalLink';

export default function Summary({ comparison }: { comparison: Comparison }) {
  const { analysis, revisionCount, editorCount } = comparison;
  const { sources } = analysis;

  return (
    <section className="reading" aria-label="Gemini reading">
      <p className="reading-label">{analysis.model ? 'Gemini’s review' : 'Revision comparison'} · Every saved edit in the period</p>
      <h2>{analysis.flaggedChanges > 0 ? `${analysis.flaggedChanges} passages flagged for review` : neutralityLabels[analysis.overallNeutrality]}</h2>
      <p>{analysis.summary}</p>
      <p><strong>Possible agenda (inferred):</strong> {analysis.possibleAgenda ?? 'No agenda was established from the inspected wording.'}</p>
      <p className="reading-note">{revisionCount} revisions by {editorCount} editors reviewed. Flags need checking and don’t show intent and AI can make mistakes.</p>
      <nav className="source-links" aria-label="Wikipedia sources">
        <span>Sources:</span>
        {sources.before && <ExternalLink href={sources.before}>Earlier revision</ExternalLink>}
        {sources.after && <ExternalLink href={sources.after}>Later revision</ExternalLink>}
        {sources.diff && <ExternalLink href={sources.diff}>Start-to-end diff ↗</ExternalLink>}
      </nav>
    </section>
  );
}

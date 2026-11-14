import { neutralityLabels } from '../labels';
import type { Comparison } from '../types';
import { flaggedEditCount } from '../utils/review';
import ExternalLink from './ExternalLink';

export default function Summary({ comparison }: { comparison: Comparison }) {
  const { analysis, revisionCount, editorCount } = comparison;
  const { sources } = analysis;
  const flaggedEdits = flaggedEditCount(analysis.changes);

  return (
    <section className="reading" aria-label="Gemini reading">
      <h2>{flaggedEdits > 0 ? `${flaggedEdits} suspicious ${flaggedEdits === 1 ? 'edit' : 'edits'} found` : neutralityLabels[analysis.overallNeutrality]}</h2>
      <p><strong>Possible agenda:</strong> {analysis.possibleAgenda ?? 'No agenda was established from the inspected wording.'}</p>
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

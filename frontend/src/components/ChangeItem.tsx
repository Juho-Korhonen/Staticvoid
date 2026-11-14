import { categoryLabels, rhetoricalCategoryLabels } from '../labels';
import type { Change, Sources } from '../types';
import type { Token } from '../utils/wikitext';
import { changedText } from '../utils/changedText';
import { isFlagged } from '../utils/review';
import ExternalLink from './ExternalLink';
import WikiText from './WikiText';

/** One side of a change: removed text in red, added text in green. */
function Passage({ side, tokens, href }: { side: 'before' | 'after'; tokens: Token[]; href: string | null }) {
  return (
    <p>
      <ExternalLink className={`change-label ${side}`} href={href}>{side === 'before' ? 'Before' : 'After'}</ExternalLink>
      <span className={side === 'before' ? 'removed' : 'added'}><WikiText tokens={tokens} /></span>
    </p>
  );
}

function direction(change: Change): string {
  if (isFlagged(change)) return 'negative';
  return change.neutrality === 'more_neutral' ? 'positive' : '';
}

export default function ChangeItem({ change, sources }: { change: Change; sources: Sources }) {
  const { revision } = change;
  const { before, after } = changedText(change.oldText, change.newText);
  return (
    <article className={`change ${direction(change)}`}>
      <strong>
        {categoryLabels[change.category] ?? 'Unclassified change'}
        {change.category === 'rhetorical_change' && change.rhetoricalCategory && ` · ${rhetoricalCategoryLabels[change.rhetoricalCategory]}`}
      </strong>
      {revision && <p className="reading-note">Revision {revision.id} · {revision.timestamp}{revision.isRevert && ' · revert'}</p>}
      <p className="change-explanation">{change.explanation}</p>
      {change.possibleAgenda && <p className="reading-note">Possible framing goal: {change.possibleAgenda}</p>}
      <div className="change-copy">
        {after && <Passage side="after" tokens={after} href={sources.after} />}
        {before && <Passage side="before" tokens={before} href={sources.before} />}
      </div>
      {change.segmentCount > 1 && (
        <p className="reading-note">Part {change.segmentIndex} of {change.segmentCount} of a long change. All parts were inspected.</p>
      )}
      {sources.diff && <ExternalLink className="diff-link" href={sources.diff}>View this edit’s diff ↗</ExternalLink>}
    </article>
  );
}

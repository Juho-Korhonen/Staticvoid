import { categoryLabels, rhetoricalCategoryLabels } from '../labels';
import type { Change, Sources } from '../types';
import { changedText } from '../utils/changedText';
import { isFlagged } from '../utils/review';
import ExternalLink from './ExternalLink';

const NOTHING_BEFORE = 'Nothing: this text was added in this edit.';
const NOTHING_AFTER = 'Nothing: this text was removed in this edit.';

/** One side of a change: removed text in red, added text in green, or why there is none. */
function Passage({ side, text, fallback, href }: { side: 'before' | 'after'; text: string | null; fallback: string; href: string | null }) {
  return (
    <p>
      <ExternalLink className={`change-label ${side}`} href={href}>{side === 'before' ? 'Before' : 'After'}</ExternalLink>
      {text
        ? <span className={side === 'before' ? 'removed' : 'added'}>{text}</span>
        : <span className="missing">{fallback}</span>}
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
        <Passage side="after" text={after} fallback={NOTHING_AFTER} href={sources.after} />
        <Passage side="before" text={before} fallback={NOTHING_BEFORE} href={sources.before} />
      </div>
      {change.segmentCount > 1 && (
        <p className="reading-note">Part {change.segmentIndex} of {change.segmentCount} of a long change. All parts were inspected.</p>
      )}
      {sources.diff && <ExternalLink className="diff-link" href={sources.diff}>View this edit’s diff ↗</ExternalLink>}
    </article>
  );
}

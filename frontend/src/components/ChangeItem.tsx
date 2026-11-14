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

// "17:55, 4.1.2015" in UTC: the time first, then the date written the Finnish way.
const EDIT_CLOCK = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
const EDIT_DATE = new Intl.DateTimeFormat('fi-FI', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });

/** The edit's time for reading; an unparseable timestamp is shown as it is. */
function editTime(timestamp: string): string {
  const time = Date.parse(timestamp);
  return Number.isFinite(time) ? `${EDIT_CLOCK.format(time)}, ${EDIT_DATE.format(time)}` : timestamp;
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
      <header className="change-header">
        <strong>
          {categoryLabels[change.category] ?? 'Unclassified change'}
          {change.category === 'rhetorical_change' && change.rhetoricalCategory && ` · ${rhetoricalCategoryLabels[change.rhetoricalCategory]}`}
        </strong>
        {revision && <time className="reading-note" dateTime={revision.timestamp}>{editTime(revision.timestamp)}{revision.isRevert && ' · revert'}</time>}
      </header>
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

import { flagLabels, neutralityLabels } from '../labels';
import type { Change, Sources } from '../types';
import { readableWikiText } from '../utils/readableWikiText';
import { isFlagged } from '../utils/review';
import ExternalLink from './ExternalLink';

const NOTHING_BEFORE = 'Nothing: this text was added in this edit.';
const NOTHING_AFTER = 'Nothing: this text was removed in this edit.';
const NOT_QUOTED = 'Not quoted by the review; see the full wording below.';

/** One side of a change: removed text in red, added text in green, or why there is none. */
function Passage({ side, text, fallback, href }: { side: 'before' | 'after'; text: string | null; fallback: string; href: string | null }) {
  return (
    <p>
      <ExternalLink className="change-label" href={href}>{side === 'before' ? 'Before' : 'After'}</ExternalLink>
      {text
        ? <span className={side === 'before' ? 'removed' : 'added'}>{readableWikiText(text)}</span>
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
  return (
    <article className={`change ${direction(change)}`}>
      <strong>{neutralityLabels[change.neutrality]}</strong>
      {change.flags.length > 0 && (
        <p className="reading-note">
          <strong>{change.severity.toUpperCase()}:</strong> {change.flags.map((flag) => flagLabels[flag]).join(' · ')}
        </p>
      )}
      {revision && <p className="reading-note">Revision {revision.id} · {revision.timestamp}{revision.isRevert && ' · revert'}</p>}
      <p className="change-explanation">{change.explanation}</p>
      {change.possibleAgenda && <p className="reading-note">Possible framing goal: {change.possibleAgenda}</p>}
      {(change.evidenceBefore || change.evidenceAfter) && (
        <div className="change-copy">
          <Passage side="after" text={change.evidenceAfter} fallback={change.newText ? NOT_QUOTED : NOTHING_AFTER} href={sources.after} />
          <Passage side="before" text={change.evidenceBefore} fallback={change.oldText ? NOT_QUOTED : NOTHING_BEFORE} href={sources.before} />
        </div>
      )}
      <details className="source-excerpts">
        <summary>Wording and neutral alternative</summary>
        <div className="change-copy">
          <Passage side="after" text={change.newText} fallback={NOTHING_AFTER} href={sources.after} />
          <Passage side="before" text={change.oldText} fallback={NOTHING_BEFORE} href={sources.before} />
        </div>
        {change.neutralWording && <p><strong>Suggested neutral wording:</strong> {readableWikiText(change.neutralWording)}</p>}
        <p className="reading-note">Wikipedia formatting simplified for readability.</p>
        {change.segmentCount > 1 && (
          <p className="reading-note">Part {change.segmentIndex} of {change.segmentCount} of a long change. All parts were inspected.</p>
        )}
        {sources.diff && <ExternalLink href={sources.diff}>View this edit’s diff ↗</ExternalLink>}
      </details>
    </article>
  );
}

import { flagLabels, neutralityLabels, type Change, type Sources } from '../types';
import { readableWikiText } from '../utils/readableWikiText';

export default function ChangeItem({ change, sources }: { change: Change; sources: Sources }) {
  const direction = change.flags.length > 0 || change.neutrality === 'less_neutral' ? 'negative' : change.neutrality === 'more_neutral' ? 'positive' : '';

  return (
    <article className={`change ${direction}`}>
      <strong>{neutralityLabels[change.neutrality]}</strong>
      {change.flags.length > 0 && <p className="reading-note"><strong>{change.severity.toUpperCase()}:</strong> {change.flags.map((flag) => flagLabels[flag]).join(' · ')}</p>}
      {change.revision && <p className="reading-note">Revision {change.revision.id} · {change.revision.timestamp}{change.revision.isRevert && ' · revert'}</p>}
      <p className="change-explanation">{change.explanation}</p>
      {change.possibleAgenda && <p className="reading-note">Possible framing goal: {change.possibleAgenda}</p>}
      <div className="change-copy evidence">
        {change.evidenceAfter && <p><a className="change-label" href={sources.after ?? undefined} target="_blank" rel="noreferrer">After</a><q>{readableWikiText(change.evidenceAfter)}</q></p>}
        {change.evidenceBefore && <p><a className="change-label" href={sources.before ?? undefined} target="_blank" rel="noreferrer">Before</a><q>{readableWikiText(change.evidenceBefore)}</q></p>}
      </div>
      <details className="source-excerpts">
        <summary>Wording and neutral alternative</summary>
        <div className="change-copy">
          {change.newText && <p><span className="change-label">After</span><span className="added">{readableWikiText(change.newText)}</span></p>}
          {change.oldText && <p><span className="change-label">Before</span><span className="removed">{readableWikiText(change.oldText)}</span></p>}
        </div>
        {change.neutralWording && <p><strong>Suggested neutral wording:</strong> {readableWikiText(change.neutralWording)}</p>}
        <p className="reading-note">Wikipedia formatting simplified for readability.</p>
        {change.segmentCount > 1 && <p className="reading-note">Part {change.segmentIndex} of {change.segmentCount} of a long change. All parts were inspected.</p>}
        {sources.diff && <a href={sources.diff} target="_blank" rel="noreferrer">View this edit’s diff ↗</a>}
      </details>
    </article>
  );
}

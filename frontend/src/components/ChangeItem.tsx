import { neutralityLabels, type Change, type Sources } from '../types';
import { readableWikiText } from '../utils/readableWikiText';

export default function ChangeItem({ change, sources }: { change: Change; sources: Sources }) {
  const direction = change.neutrality === 'more_neutral' ? 'positive' : change.neutrality === 'less_neutral' ? 'negative' : '';

  return (
    <article className={`change ${direction}`}>
      <strong>{neutralityLabels[change.neutrality]}</strong>
      <p className="change-explanation">{change.explanation}</p>
      <div className="change-copy evidence">
        {change.evidenceAfter && <p><a className="change-label" href={sources.after} target="_blank" rel="noreferrer">After</a><q>{readableWikiText(change.evidenceAfter)}</q></p>}
        {change.evidenceBefore && <p><a className="change-label" href={sources.before} target="_blank" rel="noreferrer">Before</a><q>{readableWikiText(change.evidenceBefore)}</q></p>}
      </div>
      <details className="source-excerpts">
        <summary>Wording and neutral alternative</summary>
        <div className="change-copy">
          {change.newText && <p><span className="change-label">After</span><span className="added">{readableWikiText(change.newText)}</span></p>}
          {change.oldText && <p><span className="change-label">Before</span><span className="removed">{readableWikiText(change.oldText)}</span></p>}
        </div>
        {change.neutralWording && <p><strong>Suggested neutral wording:</strong> {readableWikiText(change.neutralWording)}</p>}
        <p className="reading-note">Wikipedia formatting simplified for readability.</p>
        {change.textTruncated && <p className="reading-note">Excerpt shortened. Analysis covers only the text shown.</p>}
        <a href={sources.diff} target="_blank" rel="noreferrer">View the original diff ↗</a>
      </details>
    </article>
  );
}

import type { Analysis, Change } from '../types';
import { bySeverity, isFlagged } from '../utils/review';
import ChangeItem from './ChangeItem';

export default function ChangeList({ analysis }: { analysis: Analysis }) {
  if (analysis.changes.length === 0) {
    return <p className="message">No text changes in the saved revisions for this period.</p>;
  }

  const ordered = [...analysis.changes].sort(bySeverity);
  const flagged = ordered.filter(isFlagged);
  const other = ordered.filter((change) => !isFlagged(change));
  const items = (changes: Change[]) => changes.map((change) => (
    <li key={change.changeIndex}><ChangeItem change={change} sources={change.sources ?? analysis.sources} /></li>
  ));

  return (
    <>
      {flagged.length > 0
        ? <ol className="change-list" aria-labelledby="changes-heading">{items(flagged)}</ol>
        : <p className="message">No warning signs were flagged. You can inspect every reviewed passage below.</p>}
      {other.length > 0 && (
        <details className="remaining-changes">
          <summary>Show {other.length} other reviewed passages</summary>
          <ol className="change-list">{items(other)}</ol>
        </details>
      )}
    </>
  );
}

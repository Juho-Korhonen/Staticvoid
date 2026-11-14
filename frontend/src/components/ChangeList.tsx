import type { Comparison } from '../types';
import ChangeItem from './ChangeItem';

export default function ChangeList({ comparison }: { comparison: Comparison }) {

  if (comparison.changes.length === 0) {
    return <p className="message">No text changes in the saved revisions for this period.</p>;
  }

  const priority = { high: 0, medium: 1, low: 2, none: 3 };
  const ordered = [...comparison.changes].sort((a, b) => priority[a.severity] - priority[b.severity]);
  const isFlagged = (change: typeof ordered[number]) => change.flags.length > 0 || change.neutrality === 'less_neutral';
  const flagged = ordered.filter(isFlagged);
  const other = ordered.filter((change) => !isFlagged(change));
  const items = (changes: typeof ordered) => changes.map((change, index) => (
    <li key={index}><ChangeItem change={change} sources={change.sources ?? comparison.analysis.sources} /></li>
  ));

  return <>
    {flagged.length > 0 ? <ol className="change-list" aria-labelledby="changes-heading">{items(flagged)}</ol>
      : <p className="message">No warning signs were flagged. You can inspect every reviewed passage below.</p>}
    {other.length > 0 && <details className="remaining-changes">
      <summary>Show {other.length} other reviewed passages</summary>
      <ol className="change-list">{items(other)}</ol>
    </details>}
  </>;
}

import type { Comparison } from '../types';
import ChangeItem from './ChangeItem';

export default function ChangeList({ comparison }: { comparison: Comparison }) {

  if (!comparison.from || !comparison.to) {
    return <p className="message">Choose dates with saved revisions at both endpoints.</p>;
  }
  if (comparison.changes.length === 0) {
    return <p className="message">The article did not change between these dates.</p>;
  }

  const priority = { less_neutral: 0, more_neutral: 1, unclear: 2, unchanged: 3 };
  const ordered = [...comparison.changes].sort((a, b) => priority[a.neutrality] - priority[b.neutrality]);
  const items = (changes: typeof ordered) => changes.map((change, index) => (
    <li key={index}><ChangeItem change={change} sources={comparison.analysis.sources} /></li>
  ));

  return <>
    <ol className="change-list" aria-labelledby="changes-heading">{items(ordered.slice(0, 3))}</ol>
    {ordered.length > 3 && <details className="remaining-changes">
      <summary>Show {ordered.length - 3} more reviewed changes</summary>
      <ol className="change-list">{items(ordered.slice(3))}</ol>
    </details>}
  </>;
}

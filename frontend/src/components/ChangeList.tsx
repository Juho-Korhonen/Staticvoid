import type { Comparison } from '../types';
import ChangeItem from './ChangeItem';

export default function ChangeList({ comparison }: { comparison: Comparison }) {

  if (!comparison.from || !comparison.to) {
    return <p className="message">Pick dates on or after the first saved revision (2009-03-01).</p>;
  }
  if (comparison.changes.length === 0) {
    return <p className="message">The article did not change between these dates.</p>;
  }

  return (
    <ol className="change-list" aria-labelledby="changes-heading">
      {comparison.changes.map((change, index) => (
        <li key={`${change.kind}-${index}`}><ChangeItem change={change} /></li>
      ))}
    </ol>
  );
}

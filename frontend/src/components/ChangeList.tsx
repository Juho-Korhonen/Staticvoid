import { useState } from 'react';
import { categoryLabels } from '../labels';
import type { Analysis, Change, ChangeCategory } from '../types';
import { bySeverity, isFlagged } from '../utils/review';
import ChangeItem from './ChangeItem';

export default function ChangeList({ analysis }: { analysis: Analysis }) {
  const [category, setCategory] = useState<ChangeCategory | 'all'>('all');

  if (analysis.changes.length === 0) {
    return <p className="message">No text changes in the saved revisions for this period.</p>;
  }

  const ordered = [...analysis.changes].sort(bySeverity);
  const flagged = ordered.filter(isFlagged);
  const other = ordered.filter((change) => !isFlagged(change));
  const categories = [...new Set(flagged.map((change) => change.category))];
  const selected = category !== 'all' && categories.includes(category) ? category : 'all';
  const visible = flagged.filter((change) => selected === 'all' || change.category === selected);
  const items = (changes: Change[]) => changes.map((change) => (
    <li key={change.changeIndex}><ChangeItem change={change} sources={change.sources ?? analysis.sources} /></li>
  ));

  return (
    <>
      {flagged.length > 0 ? (
        <>
          <div className="flag-filters" role="group" aria-label="Filter flagged changes">
            <button type="button" aria-pressed={selected === 'all'} onClick={() => setCategory('all')}>All flagged ({flagged.length})</button>
            {categories.map((value) => (
              <button key={value} type="button" aria-pressed={selected === value} onClick={() => setCategory(value)}>
                {categoryLabels[value]} ({flagged.filter((change) => change.category === value).length})
              </button>
            ))}
          </div>
          <ol className="change-list" aria-labelledby="changes-heading">{items(visible)}</ol>
        </>
      ) : <p className="message">No warning signs were flagged. You can inspect every reviewed passage below.</p>}
      {other.length > 0 && (
        <details className="remaining-changes">
          <summary>Show {other.length} other reviewed passages</summary>
          <ol className="change-list">{items(other)}</ol>
        </details>
      )}
    </>
  );
}

import type { Change } from '../types';

function describe(change: Change): string {
  if (change.kind === 'added') return 'Sentence added';
  if (change.kind === 'removed') return 'Sentence removed';
  if (change.toneDelta > 0) return `More positive (+${change.toneDelta})`;
  if (change.toneDelta < 0) return `More negative (${change.toneDelta})`;
  return 'Reworded, same tone';
}

export default function ChangeItem({ change }: { change: Change }) {
  const direction = change.toneDelta > 0 ? 'positive' : change.toneDelta < 0 ? 'negative' : '';

  return (
    <article className={`change ${direction}`}>
      <div className="change-copy">
      {change.newText && <p><span className="change-label">After</span><span className="added">{change.newText}</span></p>}
      {change.oldText && <p><span className="change-label">Before</span><span className="removed">{change.oldText}</span></p>}
      </div>
      <small>
        {describe(change)}
        {change.hedgeAdded && ' · hedge added'}
      </small>
    </article>
  );
}

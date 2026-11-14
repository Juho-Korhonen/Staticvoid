import type { ChangesResponse } from '../types';
import { formatBytes } from '../format';

export default function Summary({ summary }: { summary: ChangesResponse['summary'] }) {
  const growth = summary.bytes_end - summary.bytes_start;

  return (
    <section className="summary" aria-label="Change summary">
      <div><strong>{summary.revisions}</strong>edits</div>
      <div><strong>{summary.editors}</strong>editors ({summary.anonymous_edits} anonymous edits)</div>
      <div><strong className={summary.reverts ? 'negative' : ''}>{summary.reverts}</strong>reverts</div>
      <div>
        <strong className={growth > 0 ? 'positive' : growth < 0 ? 'negative' : ''}>
          {growth > 0 ? '+' : growth < 0 ? '−' : ''}{formatBytes(Math.abs(growth))}
        </strong>
        size change
      </div>
    </section>
  );
}

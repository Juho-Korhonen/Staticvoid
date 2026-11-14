import { useId, useState } from 'react';
import { categoryLabels } from '../labels';
import type { Change, ChangeCategory } from '../types';
import { reviewHistory } from '../utils/reviewHistory';

const COLORS: Record<ChangeCategory, string> = {
  rhetorical_change: '#6353a2', trolling: '#bb4966', vandalism: '#b66b14',
  factual_update: '#287da0', sourcing_change: '#27826f', formatting: '#7a8240',
  repair: '#9a5b9f', unclear: '#657083',
};
const WIDTH = 800;
const HEIGHT = 280;
const MARGIN = { left: 52, right: 32, top: 28, bottom: 48 };
const Y_INTERVALS = 4;
const MAX_DATE_LABELS = 6;
const DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

export default function ReviewHistory({ changes, from, to }: { changes: Change[]; from: string; to: string }) {
  const id = useId();
  const [hidden, setHidden] = useState<ChangeCategory[]>([]);
  const history = reviewHistory(changes, from, to);
  if (!history) return null;
  const { buckets, categories, grouping, totalEdits, undated } = history;
  const maximum = Math.max(1, ...buckets.flatMap((bucket) => categories.map((category) => bucket.counts[category] ?? 0)));
  const tickStep = Math.max(1, Math.ceil(maximum / Y_INTERVALS));
  const ceiling = Math.ceil(maximum / tickStep) * tickStep;
  const ticks = Array.from({ length: ceiling / tickStep + 1 }, (_, index) => index * tickStep);
  const dateLabelCount = Math.min(MAX_DATE_LABELS, buckets.length);
  const dateIndices = Array.from({ length: dateLabelCount }, (_, index) => Math.round(index * (buckets.length - 1) / Math.max(1, dateLabelCount - 1)));
  const x = (index: number) => MARGIN.left + (WIDTH - MARGIN.left - MARGIN.right) * (buckets.length === 1 ? 0.5 : index / (buckets.length - 1));
  const y = (count: number) => HEIGHT - MARGIN.bottom - count / ceiling * (HEIGHT - MARGIN.top - MARGIN.bottom);
  const period = (index: number) => `${DATE.format(buckets[index].start)} – ${DATE.format(buckets[index].end - 1)}`;

  return (
    <section className="review-history" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Suspicious edit history</h2>
      {totalEdits === 0 ? (
        <p className="message">No dated suspicious edits in this period.</p>
      ) : (
        <>
          <p className="reading-note">{totalEdits} suspicious edits · Grouped by {grouping}. Select categories to show or hide their lines.</p>
          <div className="history-legend" role="group" aria-label="Chart categories">
            {categories.map((category) => (
              <button key={category} type="button" aria-pressed={!hidden.includes(category)}
                onClick={() => setHidden((current) => current.includes(category) ? current.filter((value) => value !== category) : [...current, category])}>
                <span className="history-swatch" style={{ backgroundColor: COLORS[category] }} aria-hidden="true" />
                {categoryLabels[category]} ({buckets.reduce((sum, bucket) => sum + (bucket.counts[category] ?? 0), 0)})
              </button>
            ))}
          </div>
          <div className="history-plot">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
              <title id={`${id}-title`}>Suspicious edits over time, by category</title>
              <desc id={`${id}-description`}>Time on the horizontal axis; number of distinct suspicious edits per {grouping} on the vertical axis. Exact counts are available in the table below.</desc>
              <text x={MARGIN.left} y={MARGIN.top / 2}>Suspicious edits per {grouping}</text>
              {ticks.map((tick) => (
                <g key={tick}>
                  <line className="history-grid" x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} />
                  <text x={MARGIN.left - 10} y={y(tick)} textAnchor="end" dominantBaseline="middle">{tick}</text>
                </g>
              ))}
              {dateIndices.map((index) => (
                <text key={index} x={x(index)} y={HEIGHT - MARGIN.bottom + 22} textAnchor="middle">{buckets[index].label}</text>
              ))}
              <text x={WIDTH / 2} y={HEIGHT - 4} textAnchor="middle">Time (UTC)</text>
              {categories.filter((category) => !hidden.includes(category)).map((category) => (
                <g key={category} stroke={COLORS[category]}>
                  <polyline fill="none" strokeWidth="2.5" points={buckets.map((bucket, index) => `${x(index)},${y(bucket.counts[category] ?? 0)}`).join(' ')} />
                  {buckets.map((bucket, index) => (
                    <circle key={bucket.start} cx={x(index)} cy={y(bucket.counts[category] ?? 0)} r="3.5" fill={COLORS[category]}>
                      <title>{`${period(index)}: ${categoryLabels[category]} — ${bucket.counts[category] ?? 0} edits`}</title>
                    </circle>
                  ))}
                </g>
              ))}
            </svg>
          </div>
          <p className="reading-note">Each edit counts once per category and may appear in multiple categories. Quiet periods show zero; the first and last periods may be partial.</p>
          <details className="history-counts">
            <summary>View counts by period</summary>
            <div className="history-table">
              <table>
                <caption>Suspicious edits per category · {from} to {to} (end exclusive, UTC)</caption>
                <thead><tr><th scope="col">Period</th>{categories.map((category) => <th key={category} scope="col">{categoryLabels[category]}</th>)}</tr></thead>
                <tbody>{buckets.map((bucket, index) => (
                  <tr key={bucket.start}><th scope="row">{period(index)}</th>{categories.map((category) => <td key={category}>{bucket.counts[category] ?? 0}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
      {undated > 0 && <p className="reading-note">{undated} suspicious passages have no usable revision date and could not be plotted.</p>}
    </section>
  );
}

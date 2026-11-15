import { useId, useState } from 'react';
import { LOCALES, useLanguage } from '../Language';
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

export default function ReviewHistory({ changes, from, to }: { changes: Change[]; from: string; to: string }) {
  const id = useId();
  const [hidden, setHidden] = useState<ChangeCategory[]>([]);
  const { t, language } = useLanguage();
  const history = reviewHistory(changes, from, to, LOCALES[language]);
  if (!history) return null;
  const { buckets, categories, totalEdits, undated } = history;
  const grouping = history.yearStep > 1 ? t('grouping.years', { count: history.yearStep }) : t(`grouping.${history.grouping}`);
  const dateFormat = new Intl.DateTimeFormat(LOCALES[language], { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
  const maximum = Math.max(1, ...buckets.flatMap((bucket) => categories.map((category) => bucket.counts[category] ?? 0)));
  const tickStep = Math.max(1, Math.ceil(maximum / Y_INTERVALS));
  const ceiling = Math.ceil(maximum / tickStep) * tickStep;
  const ticks = Array.from({ length: ceiling / tickStep + 1 }, (_, index) => index * tickStep);
  const dateLabelCount = Math.min(MAX_DATE_LABELS, buckets.length);
  const dateIndices = Array.from({ length: dateLabelCount }, (_, index) => Math.round(index * (buckets.length - 1) / Math.max(1, dateLabelCount - 1)));
  const x = (index: number) => MARGIN.left + (WIDTH - MARGIN.left - MARGIN.right) * (buckets.length === 1 ? 0.5 : index / (buckets.length - 1));
  const y = (count: number) => HEIGHT - MARGIN.bottom - count / ceiling * (HEIGHT - MARGIN.top - MARGIN.bottom);
  const period = (index: number) => `${dateFormat.format(buckets[index].start)} – ${dateFormat.format(buckets[index].end - 1)}`;

  return (
    <section className="review-history" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{t('historyHeading')}</h2>
      {totalEdits === 0 ? (
        <p className="message">{t('noDated')}</p>
      ) : (
        <>
          <p className="reading-note">{t('historyNote', { count: totalEdits, grouping })}</p>
          <div className="history-legend" role="group" aria-label={t('chartCategories')}>
            {categories.map((category) => (
              <button key={category} type="button" aria-pressed={!hidden.includes(category)}
                onClick={() => setHidden((current) => current.includes(category) ? current.filter((value) => value !== category) : [...current, category])}>
                <span className="history-swatch" style={{ backgroundColor: COLORS[category] }} aria-hidden="true" />
                {t(`category.${category}`)} ({buckets.reduce((sum, bucket) => sum + (bucket.counts[category] ?? 0), 0)})
              </button>
            ))}
          </div>
          <div className="history-plot">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
              <title id={`${id}-title`}>{t('chartTitle')}</title>
              <desc id={`${id}-description`}>{t('chartDescription', { grouping })}</desc>
              <text x={MARGIN.left} y={MARGIN.top / 2}>{t('chartAxis', { grouping })}</text>
              {ticks.map((tick) => (
                <g key={tick}>
                  <line className="history-grid" x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} />
                  <text x={MARGIN.left - 10} y={y(tick)} textAnchor="end" dominantBaseline="middle">{tick}</text>
                </g>
              ))}
              {dateIndices.map((index) => (
                <text key={index} x={x(index)} y={HEIGHT - MARGIN.bottom + 22} textAnchor="middle">{buckets[index].label}</text>
              ))}
              {categories.filter((category) => !hidden.includes(category)).map((category) => (
                <g key={category} stroke={COLORS[category]}>
                  <polyline fill="none" strokeWidth="2.5" points={buckets.map((bucket, index) => `${x(index)},${y(bucket.counts[category] ?? 0)}`).join(' ')} />
                  {buckets.map((bucket, index) => (
                    <circle key={bucket.start} cx={x(index)} cy={y(bucket.counts[category] ?? 0)} r="3.5" fill={COLORS[category]}>
                      <title>{t('pointTitle', { period: period(index), category: t(`category.${category}`), count: bucket.counts[category] ?? 0 })}</title>
                    </circle>
                  ))}
                </g>
              ))}
            </svg>
          </div>
          <p className="reading-note">{t('historyCaveat')}</p>
          <details className="history-counts">
            <summary>{t('viewCounts')}</summary>
            <div className="history-table">
              <table>
                <caption>{t('countsCaption', { from, to })}</caption>
                <thead><tr><th scope="col">{t('period')}</th>{categories.map((category) => <th key={category} scope="col">{t(`category.${category}`)}</th>)}</tr></thead>
                <tbody>{buckets.map((bucket, index) => (
                  <tr key={bucket.start}><th scope="row">{period(index)}</th>{categories.map((category) => <td key={category}>{bucket.counts[category] ?? 0}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
      {undated > 0 && <p className="reading-note">{t('undated', { count: undated })}</p>}
    </section>
  );
}

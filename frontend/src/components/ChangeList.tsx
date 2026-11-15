import { memo, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../Language';
import type { Analysis, Change, ChangeCategory, Sources } from '../types';
import { bySeverity, isFlagged } from '../utils/review';
import ChangeItem from './ChangeItem';

const PAGE_SIZE = 10;
const LOAD_AHEAD_PX = 200;
const MemoChangeItem = memo(ChangeItem);

export function PagedChanges({ changes, sources, labelledBy }: { changes: Change[]; sources: Sources; labelledBy?: string }) {
  const { t } = useLanguage();
  const [count, setCount] = useState(PAGE_SIZE);
  const more = useRef<HTMLButtonElement>(null);
  const shown = Math.min(count, changes.length);
  const nextCount = Math.min(count + PAGE_SIZE, changes.length);

  useEffect(() => {
    const button = more.current;
    if (!button || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        setCount(nextCount);
      }
    }, { rootMargin: `${LOAD_AHEAD_PX}px 0px` });
    observer.observe(button);
    return () => observer.disconnect();
  }, [shown, nextCount]);

  return (
    <>
      <ol className="change-list" aria-labelledby={labelledBy}>
        {changes.slice(0, shown).map((change) => (
          <li key={change.changeIndex}><MemoChangeItem change={change} sources={change.sources ?? sources} /></li>
        ))}
      </ol>
      <p className="reading-note" role="status">{t('showing', { shown, total: changes.length })}</p>
      {shown < changes.length && (
        <button ref={more} type="button" className="compare-button" onClick={() => setCount(nextCount)}>
          {t('loadMore', { count: nextCount - shown })}
        </button>
      )}
    </>
  );
}

export default function ChangeList({ analysis }: { analysis: Analysis }) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<ChangeCategory | 'all'>('all');
  const [showOther, setShowOther] = useState(false);

  if (analysis.changes.length === 0) {
    return <p className="message">{t('noTextChanges')}</p>;
  }

  const ordered = [...analysis.changes].sort(bySeverity);
  const flagged = ordered.filter(isFlagged);
  const other = ordered.filter((change) => !isFlagged(change));
  const categories = [...new Set(flagged.map((change) => change.category))];
  const selected = category !== 'all' && categories.includes(category) ? category : 'all';
  const visible = flagged.filter((change) => selected === 'all' || change.category === selected);

  return (
    <>
      {flagged.length > 0 ? (
        <>
          <div className="flag-filters" role="group" aria-label={t('filterSuspicious')}>
            <button type="button" aria-pressed={selected === 'all'} onClick={() => setCategory('all')}>{t('allSuspicious')} ({flagged.length})</button>
            {categories.map((value) => (
              <button key={value} type="button" aria-pressed={selected === value} onClick={() => setCategory(value)}>
                {t(`category.${value}`)} ({flagged.filter((change) => change.category === value).length})
              </button>
            ))}
          </div>
          <PagedChanges key={selected} changes={visible} sources={analysis.sources} labelledBy="changes-heading" />
        </>
      ) : <p className="message">{t('noSuspicious')}</p>}
      {other.length > 0 && (
        <details className="remaining-changes" onToggle={(event) => setShowOther(event.currentTarget.open)}>
          <summary>{t('showOther', { count: other.length })}</summary>
          {showOther && <PagedChanges changes={other} sources={analysis.sources} />}
        </details>
      )}
    </>
  );
}

import { useLanguage } from '../Language';

interface Props {
  from: string;
  to: string;
  minDate: string | null;
  maxDate: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  showStart: boolean;
  startDisabled: boolean;
  onStart: () => void;
}

export default function DateRangePicker({ from, to, minDate, maxDate, onFromChange, onToChange, showStart, startDisabled, onStart }: Props) {
  const { t } = useLanguage();
  return (
    <section className="date-picker" aria-label={t('reviewPeriod')}>
      <div className="date-fields">
        <label htmlFor="from-date">{t('fromDate')}<input id="from-date" type="date" min={minDate ?? undefined} max={maxDate} value={from} onChange={(event) => onFromChange(event.target.value)} /></label>
        <label htmlFor="to-date">{t('toDate')}<input id="to-date" type="date" min={minDate ?? undefined} max={maxDate} value={to} onChange={(event) => onToChange(event.target.value)} /></label>
      </div>
      {showStart && <button className="compare-button start-review" type="button" disabled={startDisabled} onClick={onStart}>{t('startReview')}</button>}
    </section>
  );
}

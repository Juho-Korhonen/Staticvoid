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
  return (
    <section className="date-picker" aria-label="Review period">
      <div className="date-fields">
        <label htmlFor="from-date">From date<input id="from-date" type="date" min={minDate ?? undefined} max={maxDate} value={from} onChange={(event) => onFromChange(event.target.value)} /></label>
        <label htmlFor="to-date">To date<input id="to-date" type="date" min={minDate ?? undefined} max={maxDate} value={to} onChange={(event) => onToChange(event.target.value)} /></label>
      </div>
      {showStart && <button className="compare-button start-review" type="button" disabled={startDisabled} onClick={onStart}>Start review</button>}
    </section>
  );
}

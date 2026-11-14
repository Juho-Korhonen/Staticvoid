interface Props {
  from: string;
  to: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  showStart: boolean;
  startDisabled: boolean;
  onStart: () => void;
}

export default function DateRangePicker({ from, to, onFromChange, onToChange, showStart, startDisabled, onStart }: Props) {
  return (
    <section className="date-picker" aria-labelledby="date-picker-heading">
      <div className="date-picker-intro">
        <h2 id="date-picker-heading">Choose two moments in time</h2>
      </div>
      <div className="date-fields">
        <label htmlFor="from-date">From date<input id="from-date" type="date" value={from} onChange={(event) => onFromChange(event.target.value)} /></label>
        <label htmlFor="to-date">To date<input id="to-date" type="date" value={to} onChange={(event) => onToChange(event.target.value)} /></label>
      </div>
      {showStart && <button className="compare-button start-review" type="button" disabled={startDisabled} onClick={onStart}>Start review</button>}
    </section>
  );
}

interface Props {
  from: string;
  to: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
}

function addYears(date: string, years: number): string {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  const targetYear = year + years;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export default function DateRangePicker({ from, to, onFromChange, onToChange }: Props) {
  return (
    <section className="date-picker" aria-labelledby="date-picker-heading">
      <div className="date-picker-intro">
        <h2 id="date-picker-heading">Choose two moments in time</h2>
        <p>Inspect every saved edit in this period. The end date is exclusive (UTC).</p>
      </div>
      <div className="date-fields">
        <label htmlFor="from-date">From date<input id="from-date" type="date" value={from} onChange={(event) => onFromChange(event.target.value)} /></label>
        <label htmlFor="to-date">To date<input id="to-date" type="date" value={to} onChange={(event) => onToChange(event.target.value)} /></label>
      </div>
      <div className="presets" aria-label="Suggested date ranges">
        <span>Try:</span>
        <button type="button" disabled={!from} onClick={() => onToChange(addYears(from, 5))}>5 years from start</button>
        <button type="button" disabled={!from} onClick={() => onToChange(addYears(from, 10))}>10 years from start</button>
      </div>
    </section>
  );
}

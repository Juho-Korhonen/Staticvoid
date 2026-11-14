interface Props {
  from: string;
  to: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
}

function addYears(date: string, years: number): string {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate();
  return `${year + years}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export default function DateRangePicker({ from, to, onFromChange, onToChange }: Props) {
  return (
    <section className="date-picker" aria-labelledby="date-picker-heading">
      <div className="date-picker-intro">
        <h2 id="date-picker-heading">Choose two moments in time</h2>
        <p>Compare saved versions of this article and see what changed.</p>
      </div>
      <div className="date-fields">
        <label htmlFor="from-date">From date<input id="from-date" type="date" value={from} onChange={(event) => onFromChange(event.target.value)} /></label>
        <label htmlFor="to-date">To date<input id="to-date" type="date" value={to} onChange={(event) => onToChange(event.target.value)} /></label>
      </div>
      <div className="presets" aria-label="Suggested date ranges">
        <span>Try:</span>
        <button type="button" disabled={!from} onClick={() => onToChange(addYears(from, 5))}>5 years apart</button>
        <button type="button" disabled={!from} onClick={() => onToChange(addYears(from, 10))}>A decade apart</button>
      </div>
    </section>
  );
}

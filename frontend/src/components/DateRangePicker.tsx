interface Props {
  from: string;
  to: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
}

const PRESET_YEARS = [5, 10];

const twoDigits = (n: number) => String(n).padStart(2, '0');

/** `date` (YYYY-MM-DD) plus whole years, clamped to the month's last day (Feb 29 -> Feb 28). */
function addYears(date: string, years: number): string {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  const targetYear = year + years;
  // Day 0 of the next month is the last day of this one (`month` is 1-based, Date.UTC's is 0-based).
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${twoDigits(month)}-${twoDigits(Math.min(day, lastDay))}`;
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
        {PRESET_YEARS.map((years) => (
          <button key={years} type="button" disabled={!from} onClick={() => onToChange(addYears(from, years))}>{years} years from start</button>
        ))}
      </div>
    </section>
  );
}

interface Props {
  from: string;
  to: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
}

export default function DateRangePicker({ from, to, onFromChange, onToChange }: Props) {
  return (
    <section className="date-picker" aria-labelledby="date-picker-heading">
      <div className="date-picker-intro">
        <h2 id="date-picker-heading">Choose two moments in time</h2>
      </div>
      <div className="date-fields">
        <label htmlFor="from-date">From date<input id="from-date" type="date" value={from} onChange={(event) => onFromChange(event.target.value)} /></label>
        <label htmlFor="to-date">To date<input id="to-date" type="date" value={to} onChange={(event) => onToChange(event.target.value)} /></label>
      </div>
    </section>
  );
}

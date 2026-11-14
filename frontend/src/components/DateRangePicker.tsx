interface Props {
  from: string;
  to: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
}

const PRESETS = [
  { label: 'Last year', from: '2020-01-01', to: '2021-12-31' },
  { label: 'A decade apart', from: '2009-06-01', to: '2019-06-01' },
];

export default function DateRangePicker({ from, to, onFromChange, onToChange }: Props) {
  return (
    <section className="date-picker" aria-labelledby="date-picker-heading">
      <div className="date-picker-intro">
        <h2 id="date-picker-heading">Choose two moments in time</h2>
        <p>Compare saved versions of this article and see what changed. Both days are included.</p>
      </div>
      <div className="date-fields">
        <label htmlFor="from-date">From date<input id="from-date" type="date" value={from} onChange={(event) => onFromChange(event.target.value)} /></label>
        <label htmlFor="to-date">To date<input id="to-date" type="date" value={to} onChange={(event) => onToChange(event.target.value)} /></label>
      </div>
      <div className="presets" aria-label="Suggested date ranges">
        <span>Try:</span>
        {PRESETS.map((preset) => <button key={preset.label} type="button" onClick={() => { onFromChange(preset.from); onToChange(preset.to); }}>{preset.label}</button>)}
      </div>
    </section>
  );
}

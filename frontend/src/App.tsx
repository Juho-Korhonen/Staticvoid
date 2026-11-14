import { useState } from 'react';
import Header from './components/Header';
import DateRangePicker from './components/DateRangePicker';
import RevisionCards from './components/RevisionCards';
import Summary from './components/Summary';
import ChangeList from './components/ChangeList';
import { useComparison } from './hooks/useComparison';

const ARTICLE_TITLE = 'Suomen sisällissota';

export default function App() {
  const [from, setFrom] = useState('2015-01-01');
  const [to, setTo] = useState('2015-03-01');
  const [range, setRange] = useState({ from: '2015-01-01', to: '2015-03-01' });
  const { data, loading, error } = useComparison(ARTICLE_TITLE, range.from, range.to);

  function updateRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextFrom && nextTo && nextFrom <= nextTo) setRange({ from: nextFrom, to: nextTo });
  }

  return (
    <>
      <Header />
      <main>
        <div className="page-tabs" aria-label="Article tools">
          <span className="page-tab active">Article history</span>
          <a className="page-tab" href="#date-picker-heading">Compare revisions</a>
        </div>
        <h1 id="article-heading">{ARTICLE_TITLE}</h1>
        <p className="subtitle">From Wikipedia, the free encyclopedia · A look at how this article changed over time</p>

        <DateRangePicker from={from} to={to} onFromChange={(date) => updateRange(date, to)} onToChange={(date) => updateRange(from, date)} />

        {from > to && <p className="message validation" role="status">The first date needs to be earlier than the second.</p>}
        {error && <p className="message error" role="alert">Could not load the comparison: {error}</p>}
        {loading && <p className="message loading" role="status">{data ? 'Updating comparison…' : 'Loading article history…'}</p>}

        {data && (
          <>
            <div aria-live="polite" aria-busy={loading}>
            <RevisionCards comparison={data} />
            <Summary changes={data.changes} />
            <h2 id="changes-heading">What changed</h2>
            <ChangeList comparison={data} />
            </div>
          </>
        )}
      </main>
    </>
  );
}

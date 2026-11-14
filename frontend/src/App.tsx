import { useState } from 'react';
import Header from './components/Header';
import ArticlePicker from './components/ArticlePicker';
import DateRangePicker from './components/DateRangePicker';
import RevisionCards from './components/RevisionCards';
import Summary from './components/Summary';
import ChangeList from './components/ChangeList';
import RevisionHistory from './components/RevisionHistory';
import { useChanges } from './hooks/useChanges';

export default function App() {
  const [title, setTitle] = useState('Talvisota');
  const [from, setFrom] = useState('2009-06-01');
  const [to, setTo] = useState('2021-12-31');
  const [range, setRange] = useState({ from: '2009-06-01', to: '2021-12-31' });
  const { data, loading, error } = useChanges(title, range.from, range.to);

  function updateRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextFrom && nextTo && nextFrom <= nextTo) setRange({ from: nextFrom, to: nextTo });
  }

  const shownTitle = data?.title ?? title;

  return (
    <>
      <Header />
      <main>
        <div className="page-tabs" aria-label="Article tools">
          <span className="page-tab active">Article history</span>
          <a className="page-tab" href="#date-picker-heading">Compare revisions</a>
          {data?.page && <a className="page-tab" href={data.page.url} target="_blank" rel="noreferrer">Open on Wikipedia</a>}
        </div>
        <h1 id="article-heading">{shownTitle}</h1>
        <p className="subtitle">
          From the Finnish Wikipedia · A look at how this article changed over time
          {data?.page && ` · ${data.page.n_versions} saved versions since ${data.page.created.slice(0, 10)}`}
        </p>

        <ArticlePicker title={title} onSelect={setTitle} />
        <DateRangePicker from={from} to={to} onFromChange={(date) => updateRange(date, to)} onToChange={(date) => updateRange(from, date)} />

        {from > to && <p className="message validation" role="status">The first date needs to be earlier than the second.</p>}
        {error && <p className="message error" role="alert">Could not load the changes: {error}</p>}
        {loading && <p className="message loading" role="status">{data ? 'Updating…' : 'Loading article history…'}</p>}

        {data && (
          <div aria-live="polite" aria-busy={loading}>
            <RevisionCards data={data} />
            <Summary summary={data.summary} />
            <h2 id="changes-heading">What changed</h2>
            <ChangeList key={`${data.page_id}-${data.range.start}-${data.range.end}`} data={data} />
            {data.revisions.length > 0 && <h2 id="history-heading">Edits in this period</h2>}
            <RevisionHistory key={`h-${data.page_id}-${data.range.start}-${data.range.end}`} data={data} />
          </div>
        )}
      </main>
    </>
  );
}

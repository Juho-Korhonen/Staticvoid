import { useState, type FormEvent } from 'react';
import Header from './components/Header';
import ArticleSearch from './components/ArticleSearch';
import DateRangePicker from './components/DateRangePicker';
import ReviewProgress from './components/ReviewProgress';
import Summary from './components/Summary';
import ReviewHistory from './components/ReviewHistory';
import ChangeList from './components/ChangeList';
import EditorOverview from './components/EditorOverview';
import { useComparison } from './hooks/useComparison';
import { useArticleDates } from './hooks/useArticleDates';
import { useLanguage, type Language } from './Language';

const DEFAULT_SEARCH = { title: 'Suomen sisällissota', from: '2015-01-01', to: '2018-01-01' };

function isValidRange(from: string, to: string, minDate: string | null, maxDate: string): boolean {
  const start = Date.parse(from), end = Date.parse(to);
  return minDate !== null && Date.parse(minDate) <= start && start < end && end <= Date.parse(maxDate);
}

export default function App() {
  const { t, language } = useLanguage();
  const [title, setTitle] = useState(DEFAULT_SEARCH.title);
  const [from, setFrom] = useState(DEFAULT_SEARCH.from);
  const [to, setTo] = useState(DEFAULT_SEARCH.to);
  // The chosen article; the review only starts from the "Start review" button.
  const [article, setArticle] = useState(DEFAULT_SEARCH.title);
  // The started review, null until the first start; `requestId` lets Start review re-run an identical review.
  // It keeps the language it was started in: switching language must not start another paid review.
  const [search, setSearch] = useState<typeof DEFAULT_SEARCH & { language: Language; requestId: number } | null>(null);
  const { data, loading, error, progress, cancel } = useComparison(search?.title ?? '', search?.from ?? '', search?.to ?? '', search?.language ?? language, search?.requestId);
  const { firstEdit, error: datesError } = useArticleDates(article);
  // Results and errors of a review of another article are not shown under this one.
  const reviewIsOfArticle = search?.title === article;
  const today = new Date().toISOString().split('T')[0];
  const validRange = isValidRange(from, to, firstEdit, today);
  // The result section that is shown; null shows neither.
  const [view, setView] = useState<'history' | 'review' | 'editors' | null>(null);

  function toggleView(next: 'history' | 'review' | 'editors') {
    setView((current) => (current === next ? null : next));
  }

  function startReview() {
    if (!validRange) return;
    setSearch((prev) => ({ title: article, from, to, language, requestId: (prev?.requestId ?? 0) + 1 }));
  }

  function chooseArticle(chosen: string) {
    if (chosen !== article && loading) cancel(); // the running review is of the previous article
    setArticle(chosen);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim()) chooseArticle(title.trim());
  }

  function chooseSuggestion(chosen: string) {
    setTitle(chosen);
    chooseArticle(chosen);
  }

  return (
    <>
      <Header />
      <main>
        <ArticleSearch
          value={title}
          selectedTitle={article}
          disabled={!title.trim() || loading}
          onChange={setTitle}
          onSubmit={submitSearch}
          onChoose={chooseSuggestion}
        />
        <h1>{article}</h1>
        <p className="subtitle">{t('compareSubtitle')}</p>

        <DateRangePicker
          from={from}
          to={to}
          minDate={firstEdit}
          maxDate={today}
          onFromChange={setFrom}
          onToChange={setTo}
          showStart={!loading}
          startDisabled={!validRange}
          onStart={startReview}
        />

        {datesError && <p className="message error" role="alert">{t('dateError')} {datesError}</p>}
        {from && to && firstEdit && !validRange && (
          <p className="message validation" role="status">
            {t('dateValidation')} {firstEdit} {t('and')} {today}.
          </p>
        )}
        {error && reviewIsOfArticle && (
          <div className="message error" role="alert">
            <p>{t('comparisonError')} {error}</p>
          </div>
        )}
        {loading && <ReviewProgress progress={progress} onCancel={cancel} />}

        {data && !loading && reviewIsOfArticle && (
          <div aria-live="polite">
            <Summary comparison={data} />
            <div className="result-views">
              <button type="button" aria-pressed={view === 'history'} onClick={() => toggleView('history')}>{t('history')}</button>
              <button type="button" aria-pressed={view === 'review'} onClick={() => toggleView('review')}>{t('fullReview')}</button>
              <button type="button" aria-pressed={view === 'editors'} onClick={() => toggleView('editors')}>{t('suspiciousEditors')}</button>
            </div>
            {view === 'history' && search && <ReviewHistory changes={data.analysis.changes} from={search.from} to={search.to} />}
            {view === 'editors' && <EditorOverview changes={data.analysis.changes} sources={data.analysis.sources} />}
            {view === 'review' && (
              <>
                <h2 id="changes-heading">{t('evidence')}</h2>
                <ChangeList analysis={data.analysis} />
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}

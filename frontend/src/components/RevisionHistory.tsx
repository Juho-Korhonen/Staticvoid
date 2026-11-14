import { useState } from 'react';
import type { ChangesResponse } from '../types';
import { diffUrl, formatDateTime } from '../format';

const PAGE = 20;

/** The individual edits in the range, newest first. */
export default function RevisionHistory({ data }: { data: ChangesResponse }) {
  const [shown, setShown] = useState(PAGE);
  const revisions = [...data.revisions].reverse();

  if (revisions.length === 0) return null;

  return (
    <>
      {data.truncated && (
        <p className="message">Showing the newest {data.summary.returned} of {data.summary.revisions} edits.</p>
      )}
      <ol className="change-list" aria-labelledby="history-heading">
        {revisions.slice(0, shown).map((r) => {
          const tone = r.is_revert ? 'negative' : r.bytes_delta > 0 ? 'positive' : '';
          return (
            <li key={r.rev_id}>
              <article className={`change ${tone}`}>
                <div className="change-copy">
                  <p>
                    <span className="change-label">{r.anonymous ? 'IP' : 'User'}</span>
                    <span>
                      <strong>{r.user ?? '(hidden)'}</strong>
                      {r.comment ? ` — ${r.comment}` : ''}
                    </span>
                  </p>
                </div>
                <small>
                  <a href={diffUrl(r.rev_id, r.parent_id)} target="_blank" rel="noreferrer">{formatDateTime(r.timestamp)}</a>
                  {' · '}
                  <span className={r.bytes_delta > 0 ? 'positive' : r.bytes_delta < 0 ? 'negative' : ''}>
                    {r.bytes_delta > 0 ? '+' : ''}{r.bytes_delta} bytes
                  </span>
                  {r.is_new_page && ' · article created'}
                  {r.minor && ' · minor'}
                  {r.is_revert && ' · revert'}
                </small>
              </article>
            </li>
          );
        })}
      </ol>
      {revisions.length > shown && (
        <div className="presets">
          <button type="button" onClick={() => setShown(shown + PAGE)}>Show more ({revisions.length - shown} left)</button>
        </div>
      )}
    </>
  );
}

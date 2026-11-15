import { Fragment, useState } from 'react';
import type { Change, Sources } from '../types';
import { useLanguage } from '../Language';
import { bySeverity, editorName, flaggedEditors, isFlagged, isAnonymous } from '../utils/review';
import { PagedChanges } from './ChangeList';
import ExternalLink from './ExternalLink';

const REPEAT_EDIT_THRESHOLD = 2;

export default function EditorOverview({ changes, sources }: { changes: Change[]; sources: Sources }) {
  const { t } = useLanguage();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const editors = flaggedEditors(changes).filter(({ edits }) => edits >= REPEAT_EDIT_THRESHOLD);
  const selectedChanges = changes.filter((change) => change.revision?.user === selectedUser && isFlagged(change)).sort(bySeverity);

  return (
    <section className="editor-overview" aria-labelledby="editors-heading">
      <h2 id="editors-heading">{t('editorsHeading')}</h2>
      {editors.length === 0 ? <p className="reading-note">{t('noRepeatEditors')}</p> : (
        <table>
          <caption>{t('repeatEditors')}</caption>
          <thead><tr><th scope="col">{t('editor')}</th><th scope="col">{t('suspiciousEdits')}</th></tr></thead>
          <tbody>
            {editors.map(({ user, edits }) => (
              <Fragment key={user}>
                <tr className="editor-row" onClick={() => setSelectedUser(selectedUser === user ? null : user)}>
                  <th scope="row">
                    <button type="button" className="editor-toggle" aria-expanded={selectedUser === user}>
                      <span aria-hidden="true">{selectedUser === user ? '▾' : '▸'}</span> {editorName(user, t('anonymous'))}
                    </button>
                  </th>
                  <td>{edits}</td>
                </tr>
                {selectedUser === user && (
                  <tr>
                    <td colSpan={2}>
                      {!isAnonymous(user) && (
                        <p className="reading-note">
                          <ExternalLink href={`https://fi.wikipedia.org/wiki/Special:Contributions/${encodeURIComponent(user)}`}>{t('contributions')}</ExternalLink>
                        </p>
                      )}
                      <PagedChanges key={user} changes={selectedChanges} sources={sources} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

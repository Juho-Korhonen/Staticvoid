import { Fragment, useState } from 'react';
import type { Change, Sources } from '../types';
import { bySeverity, editorName, flaggedEditors, isFlagged, isIpAddress } from '../utils/review';
import { PagedChanges } from './ChangeList';
import ExternalLink from './ExternalLink';

const REPEAT_EDIT_THRESHOLD = 2;

export default function EditorOverview({ changes, sources }: { changes: Change[]; sources: Sources }) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const editors = flaggedEditors(changes).filter(({ edits }) => edits >= REPEAT_EDIT_THRESHOLD);
  const selectedChanges = changes.filter((change) => change.revision?.user === selectedUser && isFlagged(change)).sort(bySeverity);

  return (
    <section className="editor-overview" aria-labelledby="editors-heading">
      <h2 id="editors-heading">Suspicious editors</h2>
      {editors.length === 0 ? <p className="reading-note">No editors with multiple suspicious edits.</p> : (
        <table>
          <caption>These users made multiple suspicious edits</caption>
          <thead><tr><th scope="col">Editor</th><th scope="col">Suspicious edits</th><th scope="col">Flag</th></tr></thead>
          <tbody>
            {editors.map(({ user, edits }) => (
              <Fragment key={user}>
                <tr className="editor-row" onClick={() => setSelectedUser(selectedUser === user ? null : user)}>
                  <th scope="row">
                    <button type="button" className="editor-toggle" aria-expanded={selectedUser === user}>
                      <span aria-hidden="true">{selectedUser === user ? '▾' : '▸'}</span> {editorName(user)}
                    </button>
                  </th>
                  <td>{edits}</td>
                  <td><strong>⚑ Repeat</strong></td>
                </tr>
                {selectedUser === user && (
                  <tr>
                    <td colSpan={3}>
                      {!isIpAddress(user) && (
                        <p className="reading-note">
                          <ExternalLink href={`https://fi.wikipedia.org/wiki/Special:Contributions/${encodeURIComponent(user)}`}>Contributions ↗</ExternalLink>
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

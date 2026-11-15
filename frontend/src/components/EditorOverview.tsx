import type { Change } from '../types';
import { flaggedEditors } from '../utils/review';
import ExternalLink from './ExternalLink';

const REPEAT_EDIT_THRESHOLD = 2;

export default function EditorOverview({ changes }: { changes: Change[] }) {
  const editors = flaggedEditors(changes);

  return (
    <section className="editor-overview" aria-labelledby="editors-heading">
      <h2 id="editors-heading">Editors</h2>
      {editors.length === 0 ? <p className="reading-note">No identified editors with suspicious edits.</p> : (
        <table>
          <caption>Selected period</caption>
          <thead><tr><th scope="col">Editor</th><th scope="col">Suspicious edits</th><th scope="col">Flag</th></tr></thead>
          <tbody>
            {editors.map(({ user, edits }) => (
              <tr key={user}>
                <th scope="row">
                  <ExternalLink href={`https://fi.wikipedia.org/wiki/Special:Contributions/${encodeURIComponent(user)}`}>{user}</ExternalLink>
                </th>
                <td>{edits}</td>
                <td>{edits >= REPEAT_EDIT_THRESHOLD && <strong>⚑ Repeat</strong>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

import { neutralityLabels, type Comparison } from '../types';

export default function Summary({ comparison }: { comparison: Comparison }) {
  const { analysis, revisionCount, editorCount } = comparison;

  return (
    <section className="reading" aria-label="Gemini reading">
      <p className="reading-label">{analysis.model ? 'Gemini’s reading' : 'Revision comparison'} · {analysis.partial ? 'Selected excerpts' : 'Compared changes'}</p>
      <h2>{neutralityLabels[analysis.overallNeutrality]}</h2>
      <p>{analysis.summary}</p>
      <p><strong>Possible agenda (inferred):</strong> {analysis.possibleAgenda ?? 'No agenda can be established from these excerpts.'}</p>
      <p className="reading-note">{revisionCount} revisions by {editorCount} editors. This describes the wording’s effect; it does not establish anyone’s intent.</p>
      {analysis.partial && <p className="reading-note">Partial reading: {analysis.changes.length} of {analysis.totalChanges} change blocks reviewed; long excerpts may be shortened.</p>}
      <nav className="source-links" aria-label="Wikipedia sources">
        <span>Sources:</span>
        <a href={analysis.sources.before} target="_blank" rel="noreferrer">Earlier revision</a>
        <a href={analysis.sources.after} target="_blank" rel="noreferrer">Later revision</a>
        <a href={analysis.sources.diff} target="_blank" rel="noreferrer">Wikipedia diff ↗</a>
      </nav>
    </section>
  );
}

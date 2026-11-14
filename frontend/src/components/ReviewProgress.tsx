import type { AnalysisProgress } from '../types';

function progressText(progress: AnalysisProgress | null): string {
  if (progress?.stage !== 'analyzing') return 'Loading all saved revisions and comparing each edit…';
  const { reviewedRevisions = 0, totalRevisions = 0, reviewedChanges = 0, totalChanges = 0,
    completedBatches = 0, totalBatches = 0 } = progress;
  return `Inspecting every saved edit: ${reviewedRevisions}/${totalRevisions} revisions, `
    + `${reviewedChanges}/${totalChanges} passages. Batch ${completedBatches}/${totalBatches}.`;
}

export default function ReviewProgress({ progress, onCancel }: { progress: AnalysisProgress | null; onCancel: () => void }) {
  return (
    <div className="message loading" role="status">
      <p>{progressText(progress)}</p>
      <button type="button" className="compare-button" onClick={onCancel}>Cancel review</button>
    </div>
  );
}

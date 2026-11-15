import type { AnalysisProgress } from '../types';
import { useLanguage } from '../Language';

function progressText(progress: AnalysisProgress | null, t: ReturnType<typeof useLanguage>['t']): string {
  if (progress?.stage !== 'analyzing') return t('loading');
  const { reviewedRevisions = 0, totalRevisions = 0, reviewedChanges = 0, totalChanges = 0,
    completedBatches = 0, totalBatches = 0 } = progress;
  return `${t('inspecting')}: ${reviewedRevisions}/${totalRevisions} revisions, `
    + `${reviewedChanges}/${totalChanges} passages. Batch ${completedBatches}/${totalBatches}.`;
}

export default function ReviewProgress({ progress, onCancel }: { progress: AnalysisProgress | null; onCancel: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="message loading" role="status">
      <p>{progressText(progress, t)}</p>
      <button type="button" className="compare-button" onClick={onCancel}>{t('cancelReview')}</button>
    </div>
  );
}

import type { ChangeCategory, OverallNeutrality, RhetoricalCategory } from './types';

export const neutralityLabels: Record<OverallNeutrality, string> = {
  more_neutral: 'More objective',
  less_neutral: 'Potential framing concerns',
  unchanged: 'No clear shift in neutrality',
  unclear: 'Not enough context to judge',
  mixed: 'Mixed: objective and rhetorical changes',
};

export const categoryLabels: Record<ChangeCategory, string> = {
  trolling: 'Trolling / provocation',
  vandalism: 'Vandalism / spam',
  rhetorical_change: 'Rhetorical change',
  factual_update: 'Factual edit',
  sourcing_change: 'Sourcing change',
  formatting: 'Formatting / spelling',
  repair: 'Repair / correction',
  unclear: 'Unclear change',
};

export const rhetoricalCategoryLabels: Record<RhetoricalCategory, string> = {
  loaded_language: 'Loaded language',
  blame_or_credit: 'Blame or credit',
  downplaying_or_exaggeration: 'Downplaying or exaggeration',
  selective_emphasis: 'Selective emphasis',
  certainty_shift: 'Changed certainty',
  attribution_shift: 'Changed attribution',
};

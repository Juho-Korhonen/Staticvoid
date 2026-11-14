import type { Flag, OverallNeutrality } from './types';

export const neutralityLabels: Record<OverallNeutrality, string> = {
  more_neutral: 'More objective',
  less_neutral: 'More rhetorical',
  unchanged: 'No clear shift in neutrality',
  unclear: 'Not enough context to judge',
  mixed: 'Mixed: objective and rhetorical changes',
};

export const flagLabels: Record<Flag, string> = {
  possible_vandalism: 'Possible vandalism',
  loaded_language: 'Loaded language',
  framing_shift: 'Framing shift',
  unsupported_claim: 'Unsupported claim',
  source_removal: 'Source removal',
  content_removal: 'Selective deletion',
  undue_weight: 'Undue emphasis',
  attribution_change: 'Attribution change',
  certainty_shift: 'Changed certainty',
};

import { FEATURES } from '../../game/content';
import type { FeatureKey } from '../../game/types';

export const featureChips = (features: FeatureKey[]): string =>
  features.map(f => `<span class="chip">${FEATURES[f].icon} ${FEATURES[f].name}</span>`).join('');

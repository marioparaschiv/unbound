import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { indicatorFeatures } from '~/indicators';

export const { start, stop, selfTest } = runFeatures(indicatorFeatures);

export { SettingsPanel } from '~/settings';

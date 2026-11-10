import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { typingIndicatorFeatures } from '~/typing-indicator';

export { SettingsPanel } from '~/settings';

export const { start, stop, selfTest } = runFeatures(typingIndicatorFeatures);

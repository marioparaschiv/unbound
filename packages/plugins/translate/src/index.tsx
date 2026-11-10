import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startTranslate } from '~/translate';

export { SettingsPanel } from '~/settings';

export const { start, stop, selfTest } = runFeatures([startTranslate]);

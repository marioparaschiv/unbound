import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { replaceSelfTest, startReplace } from '~/replace';
import SettingsPanel from '~/components/settings-panel';

export const { start, stop, selfTest } = runFeatures([startReplace], { selfTest: replaceSelfTest });

export { SettingsPanel };

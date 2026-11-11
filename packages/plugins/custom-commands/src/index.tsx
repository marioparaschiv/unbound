import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { startCommands } from '~/commands';
import SettingsPanel from '~/settings';

export const { start, stop, selfTest } = runFeatures([startCommands]);

export { SettingsPanel };

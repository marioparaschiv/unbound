import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startCommands } from '~/commands';
import SettingsPanel from '~/settings';

export function start() {
	startCommands();
}

export { featureSelfTest as selfTest, SettingsPanel };

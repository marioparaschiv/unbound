import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startIndicators } from '~/indicators';

export function start() {
	startIndicators();
}

export { featureSelfTest as selfTest };
export { SettingsPanel } from '~/settings';

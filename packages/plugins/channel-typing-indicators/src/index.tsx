import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startTypingIndicators } from '~/typing-indicator';

export { SettingsPanel } from '~/settings';

let stopIndicators = async () => {};

export function start() {
	stopIndicators = startTypingIndicators();
}

export function stop() {
	return stopIndicators();
}

export { featureSelfTest as selfTest };

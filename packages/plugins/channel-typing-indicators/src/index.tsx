import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startTypingIndicators } from '~/typing-indicator';

export { SettingsPanel } from '~/settings';

export function start() {
	startTypingIndicators();
}

export { featureSelfTest as selfTest };

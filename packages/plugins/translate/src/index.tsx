import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startTranslate, stopTranslate } from '~/translate';

export { SettingsPanel } from '~/settings';

export function start() {
	startTranslate();
}

export function stop() {
	stopTranslate();
}

export { featureSelfTest as selfTest };

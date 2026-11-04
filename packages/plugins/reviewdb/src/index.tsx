import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { SettingsPanel } from '~/settings';
import { startReviews } from '~/reviews';

export function start() {
	startReviews();
}

export { featureSelfTest as selfTest, SettingsPanel };

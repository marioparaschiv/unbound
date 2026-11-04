import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';

import { startExpressionActions, stopExpressionActions } from '~/expression-actions';

export function start() {
	startExpressionActions();
}

export function stop() {
	stopExpressionActions();
}

export { featureSelfTest as selfTest };

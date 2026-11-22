import { createLogger } from '@unbound-app/logger';
import { AppRegistry } from 'react-native';
import { createElement } from 'react';

import { adoptRestartedSurface } from '~/core/app-surfaces';
import { createPatcher } from '~/patcher/create-patcher';

const Patcher = createPatcher('unbound::surface-guard');
const Logger = createLogger('SurfaceGuard');

/**
 * @description Keeps React Native from failing when it restarts a plugin's native surface after a JavaScript reload,
 * before that plugin registers the surface again.
 */
export function start() {
	if (typeof AppRegistry?.runApplication !== 'function') {
		Logger.warn('Surface guard skipped: React Native moved AppRegistry.runApplication.');

		return;
	}

	Patcher.before(AppRegistry, 'runApplication', ({ args: [key] }) => {
		if (typeof key === 'string' && adoptRestartedSurface(AppRegistry, key, createElement)) {
			Logger.info(`Adopted surface ${key} before its plugin registered it.`);
		}
	});
}

/**
 * @description Stops adopting restarted surfaces.
 */
export function stop() {
	Patcher.unpatchAll();
}

export default { start, stop };

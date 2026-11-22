import { createLogger } from '@unbound-app/logger';
import { AppRegistry } from 'react-native';
import { createElement } from 'react';

import { adoptRestartedSurface } from '~/core/app-surfaces';
import { createPatcher } from '~/patcher/create-patcher';

const Patcher = createPatcher('unbound::surface-guard');
const Logger = createLogger('SurfaceGuard');

type SurfaceRegistry = { renderSurface: (key: string, ...rest: never[]) => void };

type SurfaceRegistryGlobal = typeof globalThis & { RN$SurfaceRegistry?: Partial<SurfaceRegistry> };

function isSurfaceRegistry(value: Partial<SurfaceRegistry> | undefined): value is SurfaceRegistry {
	return typeof value?.renderSurface === 'function';
}

function adoptBeforeRun(key: string | undefined) {
	if (typeof key === 'string' && adoptRestartedSurface(AppRegistry, key, createElement)) {
		Logger.info(`Adopted surface ${key} before its plugin registered it.`);
	}
}

/**
 * @description Keeps React Native from failing when it restarts a plugin's native surface before the plugin registers
 * it again, through `runApplication` and bridgeless Fabric's `RN$SurfaceRegistry`.
 */
export function start() {
	if (typeof AppRegistry?.runApplication !== 'function') {
		Logger.warn('Surface guard skipped: React Native moved AppRegistry.runApplication.');

		return;
	}

	Patcher.before(AppRegistry, 'runApplication', ({ args: [key] }) => adoptBeforeRun(key));

	const surfaceRegistry = (globalThis as SurfaceRegistryGlobal).RN$SurfaceRegistry;

	if (isSurfaceRegistry(surfaceRegistry)) {
		Patcher.before(surfaceRegistry, 'renderSurface', ({ args: [key] }) => adoptBeforeRun(key));
	}
}

/**
 * @description Stops adopting restarted surfaces.
 */
export function stop() {
	Patcher.unpatchAll();
}

export default { start, stop };

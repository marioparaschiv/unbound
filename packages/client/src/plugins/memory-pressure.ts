import { createLogger } from '@unbound-app/logger';
import { AppState } from 'react-native';

import { createScopedNativeBridge } from '~/native/scope';
import { isMemoryPressure } from '~/plugins/trim-level';
import { currentPlatform } from '~/native/platform';

const logger = createLogger('Plugins', 'MemoryPressure');

const OWNER = 'unbound::memory-pressure';

type Stop = () => void;

const listeners = new Set<() => void>();

let stopWatching: Stop | undefined;

function notify(): void {
	for (const listener of listeners) {
		try {
			listener();
		} catch (error) {
			logger.error('Failed to run a memory pressure listener:', error);
		}
	}
}

function watchAndroid(): Stop | undefined {
	const scope = createScopedNativeBridge(['native.java.hooks'], 'android', undefined, OWNER);
	const hooks = scope.bridge.hooks;

	if (!hooks) {
		scope.dispose();

		return undefined;
	}

	hooks.hook(
		'android.app.Application',
		'onTrimMemory',
		['int'],
		{ subclasses: true, payload: { receiver: false } },
		({ args }) => {
			if (isMemoryPressure(args[0])) {
				notify();
			}
		},
	);

	return () => scope.dispose();
}

function watchIOS(): Stop {
	const subscription = AppState.addEventListener('memoryWarning', notify);

	return () => subscription.remove();
}

function startWatching(): Stop | undefined {
	try {
		return currentPlatform() === 'android' ? watchAndroid() : watchIOS();
	} catch (error) {
		logger.error('Failed to watch memory pressure:', error);

		return undefined;
	}
}

/**
 * @description Calls `listener` whenever the system asks the app to free memory: iOS memory warnings, and Android
 * `onTrimMemory` at `TRIM_MEMORY_RUNNING_LOW` or more. Plugins empty their caches there.
 * @param listener Runs on the JavaScript thread for each warning.
 * @returns A function that stops the listener; the system is watched only while a listener remains.
 */
export function onMemoryPressure(listener: () => void): () => void {
	listeners.add(listener);
	stopWatching ??= startWatching();

	return () => {
		listeners.delete(listener);

		if (listeners.size) return;

		stopWatching?.();
		stopWatching = undefined;
	};
}

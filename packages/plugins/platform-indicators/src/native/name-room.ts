import type { PluginContext } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { keepAndroidNameRoom as android } from '~/native/android/name-room';
import { keepIOSNameRoom as ios } from '~/native/ios/name-room';

const keepNameRoom = native.definePlatform({ ios, android });

let release: (() => void | Promise<void>) | undefined;

/**
 * @description Keeps message names readable beside the platform symbols this plugin adds to their timestamps.
 * @param context The plugin's native bridge.
 */
export function startNameRoom(context: PluginContext): void {
	try {
		release = keepNameRoom(context.native);
	} catch (error) {
		logger.error('Failed to keep room for message names:', error);
	}
}

/**
 * @description Removes the hook `startNameRoom` installed, once the timestamps it changed are restored.
 */
export async function stopNameRoom(): Promise<void> {
	const current = release;

	release = undefined;
	await current?.();
}

export default { startNameRoom, stopNameRoom };

import type { NativeBridge } from '@unbound-app/api/native';

import { installNameRoom, restoreTimestamps } from '~/native/ios/worklets';

/**
 * @description Keeps message names readable when platform symbols lengthen the timestamp beside them.
 * @param native The plugin's native bridge.
 * @returns A function that removes the hook and restores the timestamps it changed.
 */
export function keepIOSNameRoom(native: NativeBridge): () => Promise<void> {
	const scope = native.ui.createScope();

	native.ui.run(installNameRoom, scope);

	return async () => {
		if (typeof native.ui.call === 'function') {
			await native.ui.call(restoreTimestamps, scope).catch(() => undefined);
		} else {
			native.ui.run(restoreTimestamps, scope);
		}

		scope.dispose();
	};
}

export default keepIOSNameRoom;

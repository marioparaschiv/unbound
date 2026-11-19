import type { NativeBridge } from '@unbound-app/api/native';

import { installNameRoom } from '~/native/ios/worklets';

/**
 * @description Keeps message names readable when platform symbols lengthen the timestamp beside them.
 * @param native The plugin's native bridge.
 * @returns A function that removes the hook.
 */
export function keepIOSNameRoom(native: NativeBridge): () => void {
	const scope = native.ui.createScope();

	native.ui.run(installNameRoom, scope);

	return () => scope.dispose();
}

export default keepIOSNameRoom;

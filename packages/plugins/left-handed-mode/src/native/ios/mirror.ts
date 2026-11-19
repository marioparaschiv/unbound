import type { NativeBridge } from '@unbound-app/api/native';

import type { StopMirror } from '~/native/stop-mirror';

import { installMirror, removeMirror } from '~/native/ios/worklets';

/**
 * @description Mirrors the iOS chat input until the returned function is called.
 * @param bridge The plugin's native bridge.
 * @returns Stops mirroring and puts the chat inputs back.
 */
export function mirrorIOS(bridge: NativeBridge): StopMirror {
	const scope = bridge.ui.createScope();

	bridge.ui.run(installMirror, scope);

	return () => {
		void bridge.ui
			.call(removeMirror, scope)
			.catch((error: unknown) => logger.error('Failed to restore the chat input:', error))
			.finally(() => scope.dispose());
	};
}

export default mirrorIOS;

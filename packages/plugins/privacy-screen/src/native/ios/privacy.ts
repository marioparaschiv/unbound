import type { NativeBridge } from '@unbound-app/api/native';

import type { PrivacyScreen } from '~/native/privacy-screen';

import { installPrivacyCover, removePrivacyCover, testPrivacyCover } from '~/native/ios/worklets';

/**
 * @description Blurs Discord in the iOS app switcher until the returned function is called.
 * @param bridge The plugin's native bridge.
 * @returns Stops the blur and its hooks, and tests the blur.
 */
export function privacyIOS(bridge: NativeBridge): PrivacyScreen {
	const scope = bridge.ui.createScope();
	const installed = bridge.ui.call(installPrivacyCover, scope).catch((error: unknown) => {
		logger.error('Failed to install the privacy cover:', error);

		return false;
	});

	return {
		stop() {
			bridge.ui.run(removePrivacyCover, scope);
			scope.dispose();
		},
		async test() {
			if (!(await installed))
				return { ok: false, detail: 'the scene delegate was not found' };

			return (await bridge.ui.call(testPrivacyCover, scope))
				? { ok: true, detail: 'the blur covers the window' }
				: { ok: false, detail: 'the blur did not reach the window' };
		},
	};
}

export default privacyIOS;

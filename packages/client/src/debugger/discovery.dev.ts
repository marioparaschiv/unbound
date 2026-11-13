import type {
	LoaderNativeBridge,
	NativeBridgeCapability,
	NativeUIBridge,
} from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';
import noop from '@unbound-app/utils/noop';

import { browseIos, type BrowseHandlers } from '~/debugger/discovery-ios.dev';
import { browseAndroid } from '~/debugger/discovery-android.dev';
import { currentPlatform } from '~/native/platform';
import { createScopedUIBridge } from '~/native/ui';
import { getNativeBridge } from '~/native/bridge';

const Logger = createLogger('Debugger', 'Discovery');

/** What the Android browse calls from its UI scope. */
const ANDROID_CAPABILITIES: NativeBridgeCapability[] = [
	'native.java.classes',
	'native.java.fields',
	'native.java.invoke',
	'native.java.construct',
	'native.java.hooks',
];

let androidUI: NativeUIBridge | undefined;

function startBrowse(bridge: LoaderNativeBridge, handlers: BrowseHandlers): () => void {
	if (currentPlatform() === 'ios') {
		// The delegate is a class defined at runtime; older loaders lack that and dial the address only.
		const objc = bridge.objc;

		if (!objc || !bridge.capabilities.includes('native.objc.classDefinition')) {
			return noop;
		}

		return browseIos(objc, handlers);
	}

	// The listeners are Java proxies, which loaders before `hooks.proxy` cannot make.
	if (
		currentPlatform() !== 'android' ||
		typeof bridge.hooks?.proxy !== 'function' ||
		!ANDROID_CAPABILITIES.every((capability) => bridge.capabilities.includes(capability))
	) {
		return noop;
	}

	androidUI ??= createScopedUIBridge(ANDROID_CAPABILITIES, 'android').bridge;

	return browseAndroid(androidUI, handlers);
}

/**
 * @description Browses the local network for debugger bridges, on platforms whose loader can.
 * @param handlers Called as bridges appear and disappear.
 * @returns Stops the browse; a no-op when browsing is unavailable.
 */
export function browseBridges(handlers: BrowseHandlers): () => void {
	const bridge = getNativeBridge();

	if (!bridge) {
		return noop;
	}

	try {
		return startBrowse(bridge, handlers);
	} catch (error) {
		Logger.error('Failed to browse for debugger bridges:', error);

		return noop;
	}
}

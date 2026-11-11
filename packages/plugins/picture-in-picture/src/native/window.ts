import type { PluginContext } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { createWindow as android } from '~/native/android/window';
import { createWindow as ios } from '~/native/ios/window';
import { createController, type Controller } from '~/lib/controller';
import { createSessionStore } from '~/lib/session-store';
import { showStartFailed } from '~/lib/failed-toast';
import { START_TIMEOUT_MS } from '~/lib/constants';

const createWindow = native.definePlatform({ ios, android });

/** The one picture in picture session the system allows at a time, which the header's button reads. */
export const sessions = createSessionStore<string>();

let controller: Controller<string> | undefined;

/**
 * @description Prepares the platform's picture in picture window and the controller the header's button toggles it with.
 * The Android window patches Discord's `ExternalPipView` and `MediaModalOverlay`; the iOS one patches `WebView` for web players.
 * @param context The plugin's native context, which the platform window opens its views with.
 */
export function openWindow(context: PluginContext): void {
	const window = createWindow(context, { onEnded: () => sessions.end() });

	controller = createController(sessions, window, {
		onFailed: showStartFailed,
		giveUpAfterMs: START_TIMEOUT_MS,
	});
}

/**
 * @description Closes the picture in picture window and ends the session, which the Addon scope cannot see.
 */
export function closeWindow(): void {
	controller?.dispose();
	controller = undefined;
	sessions.end();
}

/**
 * @description Reads the controller {@link openWindow} made.
 * @returns The controller, or `undefined` before the plugin starts or after it stops.
 */
export function windowController(): Controller<string> | undefined {
	return controller;
}

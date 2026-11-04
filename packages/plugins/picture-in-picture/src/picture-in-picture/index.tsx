import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import type { PluginContext } from '@unbound-app/api/native';

import { createController } from '~/picture-in-picture/session/controller';
import { createSessionStore } from '~/picture-in-picture/session/store';
import { showStartFailed } from '~/picture-in-picture/session/failed-toast';
import { patchOverlayHeader } from '~/picture-in-picture/button';
import { createWindow } from '~/picture-in-picture/platform';
import { START_TIMEOUT_MS } from '~/constants';

let dispose: (() => void) | undefined;

/**
 * @description Adds a picture in picture button to the media viewer's header, and opens the playing video in the system's picture in picture window.
 * Patches the render of `MediaModalOverlayHeader` and reads `MediaViewerOverlayButton`. The Addon scope removes the patch when the plugin stops.
 * @param context The plugin's native context, which the platform window opens its views with.
 */
export function startPictureInPicture(context: PluginContext): void {
	const sessions = createSessionStore<string>();
	const window = createWindow(context, { onEnded: () => sessions.end() });
	const controller = createController(sessions, window, {
		onFailed: showStartFailed,
		giveUpAfterMs: START_TIMEOUT_MS,
	});

	dispose = () => {
		controller.dispose();
		sessions.end();
	};

	patchOverlayHeader(sessions, controller);
	recordApplied(1);
}

/**
 * @description Closes the picture in picture window and ends the session, which the Addon scope cannot see.
 */
export function stopPictureInPicture(): void {
	dispose?.();
	dispose = undefined;
}

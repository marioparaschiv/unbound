import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import type { PluginContext } from '@unbound-app/api/native';

import { createController } from '~/session/controller';
import { createSessionStore } from '~/session/store';
import { showStartFailed } from '~/session/failed-toast';
import { patchOverlayHeader } from '~/button';
import { createWindow } from '~/window/platform';
import { PLUGIN_NAME, START_TIMEOUT_MS } from '~/constants';

let dispose: () => Promise<void> | undefined = () => undefined;

export function start(context: PluginContext) {
	const sessions = createSessionStore<string>();

	dispose = applyFeatures(PLUGIN_NAME, [
		() => {
			const window = createWindow(context, { onEnded: () => sessions.end() });
			const controller = createController(sessions, window, {
				onFailed: showStartFailed,
				giveUpAfterMs: START_TIMEOUT_MS,
			});
			const unpatchHeader = patchOverlayHeader(sessions, controller);

			return () => {
				unpatchHeader();
				controller.dispose();
				sessions.end();
			};
		},
	]);
}

export function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export const selfTest = featureSelfTest;

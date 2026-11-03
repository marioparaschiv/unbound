import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import type { PluginContext } from '@unbound-app/api/native';
import { storage } from '@unbound-app/api';

import { createPlayerRegistry } from '~/players/registry';
import { createController } from '~/session/controller';
import { createSessionStore } from '~/session/store';
import { createHoldStore, endWindowSession } from '~/session/hold';
import { releaseHoldsInForeground } from '~/session/foreground';
import { showStartFailed } from '~/session/failed-toast';
import { patchOverlayHeader } from '~/button';
import { patchVideoPlayers } from '~/players';
import { createWindow } from '~/window/platform';
import SettingsPanel from '~/settings';
import { PLUGIN_NAME, START_TIMEOUT_MS } from '~/constants';
import type { VideoInstance } from '~/types';

let dispose: () => Promise<void> | undefined = () => undefined;

function start(context: PluginContext) {
	const settings = storage.getBucket();
	const sessions = createSessionStore<VideoInstance>();
	const players = createPlayerRegistry();
	const holds = createHoldStore<VideoInstance>();

	dispose = applyFeatures(PLUGIN_NAME, [
		() => players.clear,
		() => releaseHoldsInForeground(holds),
		() => {
			const window = createWindow(context, {
				onEnded: (inBackground) => endWindowSession(sessions, holds, inBackground),
			});
			const controller = createController(sessions, window, {
				onFailed: showStartFailed,
				giveUpAfterMs: START_TIMEOUT_MS,
			});
			const unpatchHeader = patchOverlayHeader(players, sessions, controller);

			return () => {
				unpatchHeader();
				controller.dispose();
			};
		},
		() => patchVideoPlayers(players, sessions, holds, settings),
	]);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};

import type { PluginContext } from '@unbound-app/api/native';

import { startPlayer, stopPlayer } from '~/lib/player';
import { patchActionSheets } from '~/patches';
import { registerCommands } from '~/commands';

export function start(context: PluginContext) {
	startPlayer(context);
	patchActionSheets();
	registerCommands();
}

export function stop() {
	stopPlayer();
}

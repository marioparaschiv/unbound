import type { PluginContext } from '@unbound-app/api/native';

import { backgroundPlayback } from '~/native/background';

let playback: ReturnType<typeof backgroundPlayback> | undefined;

export function start(context: PluginContext) {
	playback = backgroundPlayback(context.native);
}

export function stop() {
	playback?.dispose();
	playback = undefined;
}

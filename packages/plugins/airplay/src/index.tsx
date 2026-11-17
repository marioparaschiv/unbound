import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import type { AirPlay } from '~/native/ios/airplay';
import { createAirPlay } from '~/native/airplay';
import { patchOverlayHeader } from '~/patches';

let airPlay: AirPlay | undefined;

export function start(context: PluginContext) {
	airPlay = createAirPlay(context.native);

	if (airPlay) patchOverlayHeader(airPlay);
}

export function stop() {
	patcher.unpatchAll();
	airPlay?.dispose();
	airPlay = undefined;
}

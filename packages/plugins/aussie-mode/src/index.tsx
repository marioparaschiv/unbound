import type { PluginContext } from '@unbound-app/api/native';

import { isAussieDevice } from '~/locale';
import { startRotation } from '~/rotation';
import { startUpsideDownText } from '~/text';

let stopRotation = () => {};

export function start(context: PluginContext) {
	if (!isAussieDevice()) return;

	// Last, so a failure in the text feature never leaves the screen turned over.
	startUpsideDownText();
	stopRotation = startRotation(context.native, (error) => console.error('[Aussie Mode]', error));
}

export function stop() {
	stopRotation();
	stopRotation = () => {};
}

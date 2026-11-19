import type { PluginContext } from '@unbound-app/api/native';

import type { StopMirror } from '~/native/stop-mirror';
import { mirrorInput } from '~/native/mirror-input';

let stopMirror: StopMirror | undefined;

export function start(context: PluginContext) {
	stopMirror = mirrorInput(context.native);
}

export function stop() {
	stopMirror?.();
	stopMirror = undefined;
}

import type { PluginContext } from '@unbound-app/api/native';
import { patcher } from '@unbound-app/api';

import { patchMessageSheet } from '~/patches';
import { interceptAudioMessages, patchAudioSending } from '~/send';

export function start(context: PluginContext) {
	patchMessageSheet(context.native);
	patchAudioSending();
	interceptAudioMessages();
}

export function stop() {
	patcher.unpatchAll();
}

import type { PluginContext } from '@unbound-app/api/native';
import { patcher, storage } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { parseSpeed } from '~/lib/speed';

import { patchMessageSheet } from '~/patches';
import { interceptAudioMessages, patchAudioSending } from '~/send';
import { voiceMessageSpeed } from '~/native/speed';

let speed: ReturnType<typeof voiceMessageSpeed> | undefined;
let stopWatching: (() => void) | undefined;

export function start(context: PluginContext) {
	patchMessageSheet(context.native);
	patchAudioSending();
	interceptAudioMessages();
	speed = voiceMessageSpeed(context.native, () => parseSpeed(settings.speed));
	stopWatching = storage.onChange(
		({ store }) => store === addon.id,
		() => speed?.refresh(),
	);
}

export function stop() {
	stopWatching?.();
	stopWatching = undefined;
	speed?.dispose();
	speed = undefined;
	patcher.unpatchAll();
}

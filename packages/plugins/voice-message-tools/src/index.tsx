import type { PluginContext } from '@unbound-app/api/native';
import { patcher, storage } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { downloadVoiceMessage } from '~/download';
import { parseSpeed } from '~/lib/speed';
import { nextSpeed } from '~/lib/speeds';
import { voicePillControls } from '~/native/pill';
import { voiceMessageSpeed } from '~/native/speed';
import { interceptAudioMessages, patchAudioSending } from '~/send';

let speed: ReturnType<typeof voiceMessageSpeed> | undefined;
let pill: ReturnType<typeof voicePillControls> | undefined;
let stopWatching: (() => void) | undefined;

export function start(context: PluginContext) {
	const chosenSpeed = () => parseSpeed(settings.speed);

	patchAudioSending();
	interceptAudioMessages();
	speed = voiceMessageSpeed(context.native, chosenSpeed);
	pill = voicePillControls(context.native, chosenSpeed, (action, messageId) => {
		if (action === 'speed') settings.speed = nextSpeed(settings.speed);
		else void downloadVoiceMessage(context.native, messageId);
	});
	stopWatching = storage.onChange(
		({ store }) => store === addon.id,
		() => {
			speed?.refresh();
			pill?.refresh();
		},
	);
}

export function stop() {
	stopWatching?.();
	stopWatching = undefined;
	pill?.dispose();
	pill = undefined;
	speed?.dispose();
	speed = undefined;
	patcher.unpatchAll();
}

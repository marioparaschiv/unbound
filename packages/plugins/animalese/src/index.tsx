import type { PluginContext } from '@unbound-app/api/native';
import { linkPlayer, type LinkPlayer } from '@unbound-plugins/shared/media/link-player';

import { createSpeaker, type Speaker } from '~/lib/speaker';
import { listenToMessages } from '~/flux/listeners';

let player: LinkPlayer | undefined;
let speaker: Speaker | undefined;
let stopListening: (() => void) | undefined;

export function start(context: PluginContext) {
	player = linkPlayer(context.native, context.tempPath);
	speaker = createSpeaker(player);
	stopListening = listenToMessages(speaker);
}

export function stop() {
	stopListening?.();
	stopListening = undefined;
	speaker?.stop();
	speaker = undefined;
	player?.dispose();
	player = undefined;
}

import type { PluginContext } from '@unbound-app/api/native';
import { linkPlayer, type LinkPlayer } from '@unbound-plugins/shared/media/link-player';
import { patcher } from '@unbound-app/api';

import { createMorsePlayer, type MorsePlayer } from '~/lib/playback';
import { registerMorseCommand } from '~/commands';
import { patchActionSheets } from '~/patches';

let sounds: LinkPlayer | undefined;
let player: MorsePlayer | undefined;

export function start(context: PluginContext) {
	sounds = linkPlayer(context.native, context.tempPath);
	player = createMorsePlayer(sounds);
	registerMorseCommand();
	patchActionSheets(player);
}

export function stop() {
	player?.stop();
	player = undefined;
	sounds?.dispose();
	sounds = undefined;
	patcher.unpatchAll();
}

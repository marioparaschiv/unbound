import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { DCDSoundManager, SelectedChannelStore } from '~/moyai/modules';
import { playOnReactions } from '~/moyai/reaction-add';
import { playOnMessages } from '~/moyai/message-create';
import { createPlayer, type Player } from '~/moyai/sound';
import { msPerDurationUnit } from '~/moyai/platform';

let player: Player | undefined;

/**
 * @description Plays a thud for each Moyai in messages and reactions of the selected channel.
 * Listens to the `MESSAGE_CREATE` and `MESSAGE_REACTION_ADD` Flux actions, reads the channel from
 * `SelectedChannelStore`, and plays through the native `DCDSoundManager`. The Addon scope removes the listeners.
 */
export function startMoyai(): void {
	if (!ensureModules('Moyai', { DCDSoundManager, SelectedChannelStore })) return;

	player = createPlayer(DCDSoundManager, msPerDurationUnit);

	playOnMessages(player);
	playOnReactions(player);
	recordApplied(2);
}

/**
 * @description Stops the sound and releases it, which the Addon scope cannot do for a native module.
 */
export function stopMoyai(): void {
	player?.dispose();
	player = undefined;
}

import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { DCDSoundManager, SelectedChannelStore } from '~/moyai/modules';
import { playOnReactions } from '~/moyai/reaction-add';
import { playOnMessages } from '~/moyai/message-create';
import { createPlayer } from '~/moyai/sound';
import { msPerDurationUnit } from '~/moyai/platform';

/**
 * @description Plays a thud for each Moyai in messages and reactions of the selected channel.
 * Listens to the `MESSAGE_CREATE` and `MESSAGE_REACTION_ADD` Flux actions, reads the channel from
 * `SelectedChannelStore`, and plays through the native `DCDSoundManager`. The Addon scope removes the listeners.
 * @returns A function that stops the sound and releases it, which the Addon scope cannot do for a native module.
 */
export function startMoyai(): (() => void) | undefined {
	if (!ensureModules({ DCDSoundManager, SelectedChannelStore })) return;

	const player = createPlayer(DCDSoundManager, msPerDurationUnit);

	playOnMessages(player);
	playOnReactions(player);

	return () => player.dispose();
}

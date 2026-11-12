import { native } from '@unbound-app/api';

import { createPlayer, type Player, type SoundManager } from '~/lib/sound';
import { msPerDurationUnit } from '~/lib/duration-unit';

let player: Player | undefined;

/**
 * @description Prepares the Moyai sound with Discord's native `DCDSoundManager`, which the listeners play through.
 */
export function preparePlayer(): void {
	const DCDSoundManager = native.getNativeModule<SoundManager | undefined>('DCDSoundManager');

	if (!DCDSoundManager) {
		logger.warn('Moyai skipped: Discord moved DCDSoundManager.');

		return;
	}

	player = createPlayer(DCDSoundManager, msPerDurationUnit);
}

/**
 * @description Plays the Moyai sound once, if it was prepared.
 */
export function playMoyai(): void {
	void player?.play();
}

/**
 * @description Stops the sound and releases it, which the Addon scope cannot do for a native module.
 */
export function releasePlayer(): void {
	player?.dispose();
	player = undefined;
}

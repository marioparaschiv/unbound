import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { createPlayingTracker, hasEffectShape, type BurstEffect } from '~/playing';
import { isDiscordLimit } from '~/super-reactions';
import { EFFECT_LIFETIME_MS } from '~/constants';

export const PLAY_ACTION = 'BURST_REACTION_EFFECT_PLAY';

export const CLEAR_ACTION = 'BURST_REACTION_EFFECT_CLEAR';

/**
 * @description Drops Super Reaction animations past the playing limit before Discord's burst reaction effects store plays them.
 * Counts the animations it lets through from `BURST_REACTION_EFFECT_PLAY` on each message until their `BURST_REACTION_EFFECT_CLEAR` arrives, and warns once if a play action lacks the ids it counts by.
 * @returns A function that removes the interceptors.
 */
export function limitPlayingEffects(): () => void {
	const tracker = createPlayingTracker(EFFECT_LIFETIME_MS);
	let warnedShape = false;

	function warnUnexpectedShape(effect: BurstEffect) {
		if (warnedShape || hasEffectShape(effect)) return;

		warnedShape = true;
		logger.warn(
			`${PLAY_ACTION} has no channelId or messageId in this Discord build; the playing limit cannot tell messages apart`,
			Object.keys(effect),
		);
	}

	const removePlay = flux.interceptAction(PLAY_ACTION, (action) => {
		const effect = action as BurstEffect;
		const limit = settings.superReactionPlayingLimit;

		warnUnexpectedShape(effect);

		if (isDiscordLimit(limit)) {
			tracker.admit(effect, Infinity, Date.now());

			return false;
		}

		return !tracker.admit(effect, limit, Date.now());
	});

	const removeClear = flux.interceptAction(CLEAR_ACTION, (action) => {
		tracker.clear(action as BurstEffect);

		return false;
	});

	return () => {
		removeClear();
		removePlay();
		tracker.reset();
	};
}

export default limitPlayingEffects;

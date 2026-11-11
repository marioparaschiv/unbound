export type BurstEffect = {
	channelId?: unknown;
	messageId?: unknown;
	emoji?: { id?: unknown; name?: unknown } | null;
	key?: unknown;
};

type PlayingEffect = {
	message: string;
	expiresAt: number;
};

export type PlayingTracker = {
	admit(effect: BurstEffect, limit: number, now: number): boolean;
	clear(effect: BurstEffect): void;
	playing(message: BurstEffect, now: number): number;
	reset(): void;
};

function part(value: unknown): string {
	return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * @description Builds the identity of the message a Super Reaction animation plays on.
 * @param effect The action's channel and message.
 * @returns A key shared by every animation on that message.
 */
export function messageKey(effect: BurstEffect): string {
	return `${part(effect.channelId)}:${part(effect.messageId)}`;
}

/**
 * @description Builds the identity of a Super Reaction animation from its play or clear action.
 * @param effect The action's channel, message, emoji and key.
 * @returns A key that is the same for the play and clear actions of one animation.
 */
export function effectKey(effect: BurstEffect): string {
	const emoji = effect.emoji ?? {};

	return [messageKey(effect), part(emoji.id) || part(emoji.name), part(effect.key)].join(':');
}

/**
 * @description Says whether a play action carries the channel and message the tracker counts by.
 * @param effect The action.
 * @returns `true` when both ids are present.
 */
export function hasEffectShape(effect: BurstEffect): boolean {
	return part(effect.channelId) !== '' && part(effect.messageId) !== '';
}

/**
 * @description Counts the Super Reaction animations playing on each message, so new ones past a limit can be dropped, as Discord's own limit counts per message.
 * An animation counts until its clear action arrives, or until it expires, so a missed clear never blocks animations for good.
 * @param lifetime How long an animation counts without a clear action, in milliseconds.
 * @returns The tracker.
 */
export function createPlayingTracker(lifetime: number): PlayingTracker {
	const effects = new Map<string, PlayingEffect>();

	function prune(now: number) {
		for (const [key, effect] of effects) {
			if (effect.expiresAt <= now) effects.delete(key);
		}
	}

	function countOn(message: string, now: number): number {
		prune(now);

		let count = 0;

		for (const effect of effects.values()) {
			if (effect.message === message) count++;
		}

		return count;
	}

	function admit(effect: BurstEffect, limit: number, now: number): boolean {
		const key = effectKey(effect);
		const message = messageKey(effect);

		if (!effects.has(key) && countOn(message, now) >= limit) return false;

		effects.set(key, { message, expiresAt: now + lifetime });

		return true;
	}

	return {
		admit,
		clear: (effect) => void effects.delete(effectKey(effect)),
		playing: (message, now) => countOn(messageKey(message), now),
		reset: () => effects.clear(),
	};
}

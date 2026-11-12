import { reactionAvatarPrefix } from '~/lib/avatars';
import type { ReactionChange } from '~/lib/types';

/** Runs a refresh for a key at most once per cooldown, with one trailing run for changes during it. */
export type RefreshThrottle = {
	request: (key: string) => void;
	cancel: () => void;
};

/** How long a reaction's reactors stay fetched before another change refetches them. */
export const REACTOR_REFRESH_COOLDOWN_MS = 10_000;

/**
 * @description Finds the reactor cache key prefix a reaction change touches: one emoji's reactors, or the whole message
 * when the change removed every reaction or named no emoji.
 * @param event The `MESSAGE_REACTION_*` payload.
 * @returns The prefix, or `undefined` when the event names no message or channel.
 */
export function changedReactorsPrefix(event: ReactionChange): string | undefined {
	const messageId = event.messageId ?? event.message_id;
	const channelId = event.channelId ?? event.channel_id;

	if (!messageId || !channelId) return undefined;

	const prefix = reactionAvatarPrefix(channelId, messageId);
	const emoji = event.emoji?.id ?? event.emoji?.name;

	return emoji ? `${prefix}${encodeURIComponent(emoji)}:` : prefix;
}

/**
 * @description Throttles refreshes per key, so a busy message refetches each reaction's reactors at most once per cooldown.
 * @param cooldownMs The shortest time between two runs for one key.
 * @param run Refreshes a key.
 * @returns The throttle.
 */
export function createRefreshThrottle(
	cooldownMs: number,
	run: (key: string) => void,
): RefreshThrottle {
	const lastRuns = new Map<string, number>();
	const trailing = new Map<string, ReturnType<typeof setTimeout>>();

	function runNow(key: string) {
		lastRuns.set(key, Date.now());
		run(key);
	}

	return {
		request(key) {
			if (trailing.has(key)) return;

			const wait = (lastRuns.get(key) ?? -Infinity) + cooldownMs - Date.now();

			if (wait <= 0) {
				runNow(key);

				return;
			}

			trailing.set(
				key,
				setTimeout(() => {
					trailing.delete(key);
					runNow(key);
				}, wait),
			);
		},
		cancel() {
			for (const timer of trailing.values()) clearTimeout(timer);

			trailing.clear();
			lastRuns.clear();
		},
	};
}

export default createRefreshThrottle;

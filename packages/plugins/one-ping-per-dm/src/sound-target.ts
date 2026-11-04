import { messageChannelId, type PingMessage } from '~/ping-rules';

export type RecentMessage = {
	message: PingMessage;
	receivedAt: number;
};

export type SoundTarget = { message: PingMessage } | { channelId: string } | undefined;

const SNOWFLAKE = /^\d{15,25}$/;

function asMessage(value: unknown): PingMessage | undefined {
	if (!value || typeof value !== 'object') return undefined;

	const candidate = value as Partial<PingMessage>;

	if (typeof candidate.id !== 'string') return undefined;
	if (typeof messageChannelId(candidate as PingMessage) !== 'string') return undefined;

	return candidate as PingMessage;
}

function nestedMessage(value: unknown): PingMessage | undefined {
	if (!value || typeof value !== 'object') return undefined;

	return asMessage((value as { message?: unknown }).message);
}

function nestedChannelId(value: unknown): string | undefined {
	if (typeof value === 'string') return SNOWFLAKE.test(value) ? value : undefined;
	if (!value || typeof value !== 'object') return undefined;

	const { channelId, channel_id, id } = value as Record<string, unknown>;
	const found = [channelId, channel_id].find((entry) => typeof entry === 'string');

	if (typeof found === 'string') return found;

	return typeof id === 'string' && 'type' in value ? id : undefined;
}

/**
 * @description Finds the message, or else the channel, that a call to play the in-app message sound is for.
 * @param args The call's arguments.
 * @returns The message or channel named by the arguments, or `undefined` when they name neither.
 */
export function findSoundTarget(args: readonly unknown[]): SoundTarget {
	for (const arg of args) {
		const message = asMessage(arg) ?? nestedMessage(arg);

		if (message) return { message };
	}

	for (const arg of args) {
		const channelId = nestedChannelId(arg);

		if (channelId) return { channelId };
	}

	return undefined;
}

/**
 * @description Keeps the last messages Discord received, so a sound call that names only a channel, or nothing, can be matched to its message.
 * @param limit How many messages to keep.
 * @param maxAge How long, in milliseconds, a message stays a match.
 * @returns Functions to record a message and resolve a sound call.
 */
export function createRecentMessages(limit: number, maxAge: number) {
	const recent: RecentMessage[] = [];

	function record(message: PingMessage, receivedAt: number): void {
		recent.push({ message, receivedAt });

		if (recent.length > limit) recent.splice(0, recent.length - limit);
	}

	function resolve(target: SoundTarget, now: number): PingMessage | undefined {
		if (target && 'message' in target) return target.message;

		for (let index = recent.length - 1; index >= 0; index--) {
			const entry = recent[index]!;

			if (now - entry.receivedAt > maxAge) return undefined;

			if (!target || messageChannelId(entry.message) === target.channelId) {
				return entry.message;
			}
		}

		return undefined;
	}

	function clear(): void {
		recent.length = 0;
	}

	return { record, resolve, clear };
}

export type RecentMessages = ReturnType<typeof createRecentMessages>;

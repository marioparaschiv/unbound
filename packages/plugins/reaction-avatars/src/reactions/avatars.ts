import { Avatar } from '~/constants';

export type ReactionCounts = {
	burst_count?: number;
	count?: number;
	count_details?: {
		burst?: number;
		normal?: number;
	};
};

export type ReactionEmoji = {
	id: string | null;
	name: string;
};

export type Reactor = {
	id: string;
	username?: string;
	avatar?: string | null;
};

export type ReactorSelection = {
	count: number;
	// Reaction types to request: `0` for normal reactions, `1` for super (burst) reactions.
	types: number[];
};

export type AvatarStack<T> = {
	overflowCount: number;
	users: T[];
};

function count(value: number | undefined): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * @description Works out how many people reacted and which reaction types to fetch them for.
 * @param reaction The message reaction's counts.
 * @param type The reaction type the pill shows, or `undefined` when it shows both.
 * @returns The reactor count and the types to request.
 */
export function reactionAvatarSelection(reaction: ReactionCounts, type?: number): ReactorSelection {
	const burstCount = count(reaction.count_details?.burst ?? reaction.burst_count);
	const normalCount = count(
		reaction.count_details?.normal ?? Math.max(0, count(reaction.count) - burstCount),
	);

	if (type === 0) return { count: normalCount, types: normalCount ? [0] : [] };

	if (type === 1) return { count: burstCount, types: burstCount ? [1] : [] };

	const types = [];

	if (normalCount) types.push(0);

	if (burstCount) types.push(1);

	return { count: normalCount + burstCount, types };
}

/**
 * @description Builds the cache key for one reaction's reactor list.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @param emoji The reaction's emoji.
 * @param types The reaction types the list covers.
 * @returns A key that starts with {@link reactionAvatarPrefix} for the same message.
 */
export function reactionAvatarKey(
	channelId: string,
	messageId: string,
	emoji: ReactionEmoji,
	types: number[],
): string {
	return [channelId, messageId, emoji.id ?? emoji.name, types.join(',')]
		.map((part) => encodeURIComponent(part))
		.join(':');
}

/**
 * @description Builds the prefix every reactor cache key of one message starts with.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @returns The key prefix.
 */
export function reactionAvatarPrefix(channelId: string, messageId: string): string {
	return `${encodeURIComponent(channelId)}:${encodeURIComponent(messageId)}:`;
}

/**
 * @description Picks the faces to draw and the count for the `+N` badge.
 * @template T The reactor type.
 * @param users The loaded reactors, in API order.
 * @param totalCount How many people reacted in total.
 * @returns The faces to draw and how many people the badge stands for.
 */
export function reactionAvatarStack<T>(users: T[], totalCount: number): AvatarStack<T> {
	const total = Math.max(0, Math.floor(totalCount));
	const visible = users.slice(0, Math.min(Avatar.limit, total));

	return { overflowCount: Math.max(0, total - visible.length), users: visible };
}

/**
 * @description Counts the slots to reserve before reactors load: one per face plus one for the badge.
 * @param totalCount How many people reacted in total.
 * @returns The slot count.
 */
export function reactionAvatarReservedSlotCount(totalCount: number): number {
	const total = Math.max(0, Math.floor(totalCount));

	return Math.min(total, Avatar.limit) + Number(total > Avatar.limit);
}

/**
 * @description Measures the width of an overlapping stack of avatar slots.
 * @param slotCount The number of slots.
 * @returns The width in points.
 */
export function reactionAvatarStackWidth(slotCount: number): number {
	return Avatar.size + Math.max(0, slotCount - 1) * Avatar.step;
}

/**
 * @description Lists the left offset of each slot in an avatar stack.
 * @param slotCount The number of slots.
 * @returns One offset per slot.
 */
export function reactionAvatarStackPositions(slotCount: number): number[] {
	return Array.from(
		{ length: Math.max(0, Math.floor(slotCount)) },
		(_, index) => index * Avatar.step,
	);
}

/**
 * @description Works out how much wider a reaction pill gets to fit its avatar stack.
 * @param width The avatar stack's width.
 * @param measured Whether there is a stack at all.
 * @returns The extra width in whole points.
 */
export function reactionAvatarExtraWidth(width: number, measured: boolean): number {
	if (!measured || !Number.isFinite(width) || width <= 0) return 0;

	return Math.max(0, Math.ceil(width + Avatar.trailingPadding - Avatar.leadingInset));
}

/**
 * @description Works out the extra pill width to reserve from the reaction count, before the stack is measured.
 * @param totalCount How many people reacted in total.
 * @returns The extra width in whole points.
 */
export function reactionAvatarReservedExtraWidth(totalCount: number): number {
	const width = reactionAvatarStackWidth(reactionAvatarReservedSlotCount(totalCount));

	return reactionAvatarExtraWidth(width, totalCount > 0);
}

/**
 * @description Decides whether a measured stack width replaces the reserved one.
 * @param measured Whether the stack was already measured.
 * @param currentWidth The width in use.
 * @param nextWidth The newly measured width.
 * @returns `true` for the first measurement, unless it would shrink the reserved width.
 */
export function shouldMeasureReactionAvatarWidth(
	measured: boolean,
	currentWidth: number,
	nextWidth: number,
): boolean {
	return !measured && nextWidth >= currentWidth - 0.5;
}

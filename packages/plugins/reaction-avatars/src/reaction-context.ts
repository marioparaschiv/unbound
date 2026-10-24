import type { ReactionCounts, ReactionEmoji } from '~/avatars';
import { reactionAvatarKey, reactionAvatarSelection } from '~/avatars';

export type Reaction = ReactionCounts & {
	emoji:
		| string
		| {
				animatedName?: string;
				id?: string | number | null;
				name?: string | null;
		  };
	type?: number;
};

export type ReactionContext = {
	channelId: string;
	emoji: ReactionEmoji;
	key: string;
	messageId: string;
	reaction: Reaction;
	reactionType?: number;
};

/**
 * @description Identifies one message for layout ownership.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @returns The message's key.
 */
export function messageKey(channelId: string, messageId: string): string {
	return `${channelId}:${messageId}`;
}

function reactionEmoji({ emoji }: Reaction): ReactionEmoji | null {
	if (typeof emoji === 'string') return emoji ? { id: null, name: emoji } : null;

	const name = emoji.name || emoji.animatedName;

	return name ? { id: emoji.id ? String(emoji.id) : null, name } : null;
}

/**
 * @description Describes the reactor list one reaction pill should show.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @param reaction The message reaction the pill renders.
 * @returns The context, or `null` when the reaction has no emoji name or no reactors.
 */
export function reactionContext(
	channelId: string,
	messageId: string,
	reaction: Reaction,
): ReactionContext | null {
	const emoji = reactionEmoji(reaction);

	if (!emoji) return null;

	const selection = reactionAvatarSelection(reaction, reaction.type);

	if (selection.count === 0 || selection.types.length === 0) return null;

	return {
		channelId,
		emoji,
		key: reactionAvatarKey(channelId, messageId, emoji, selection.types),
		messageId,
		reaction,
		reactionType: reaction.type,
	};
}

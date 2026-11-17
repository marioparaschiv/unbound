import { metro } from '@unbound-app/api';

const REACTION_GAP_MS = 400;

type ReactionActionCreators = {
	addReaction: (
		channelId: string,
		messageId: string,
		emoji: { id: null; name: string },
	) => Promise<unknown>;
};

const Reactions = metro.findByFilePath('modules/reactions/ReactionActionCreators.tsx', {
	lazy: true,
}) as ReactionActionCreators | undefined;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @description Adds reactions one at a time, spaced out so Discord's rate limit lets each through.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @param emoji The reactions, in order.
 * @returns How many were added before one failed, or all of them.
 */
export async function addReactions(
	channelId: string,
	messageId: string,
	emoji: string[],
): Promise<number> {
	let added = 0;

	for (const name of emoji) {
		try {
			await Reactions?.addReaction(channelId, messageId, { id: null, name });
			added++;
		} catch (error) {
			logger.error(`Failed to add reaction ${name} to message ${messageId}:`, error);

			return added;
		}

		await wait(REACTION_GAP_MS);
	}

	return added;
}

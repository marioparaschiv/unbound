import { metro } from '@unbound-app/api';

import { reactionAvatarSelection, type Reactor } from '~/avatars';
import type { ReactionContext } from '~/reaction-context';
import { ReactionActions } from '~/modules';
import { Avatar } from '~/constants';

/**
 * @description Fetches the first reactors of a reaction, across its reaction types, and shares them with Discord's stores.
 * @param context The reaction to fetch for.
 * @returns Up to `Avatar.limit` distinct reactors, in API order.
 */
export async function fetchReactors(context: ReactionContext): Promise<Reactor[]> {
	const { types } = reactionAvatarSelection(context.reaction, context.reactionType);
	const users = new Map<string, Reactor>();

	for (const type of types) {
		const remaining = Avatar.limit - users.size;

		if (remaining <= 0) break;

		try {
			const result: (Reactor | null)[] = (
				(await ReactionActions.getReactors({
					channelId: context.channelId,
					emoji: context.emoji,
					limit: remaining,
					messageId: context.messageId,
					type,
				})) ?? []
			).slice(0, remaining);

			metro.common.Dispatcher.dispatch({
				type: 'MESSAGE_REACTION_ADD_USERS',
				channelId: context.channelId,
				emoji: context.emoji,
				messageId: context.messageId,
				reactionType: type,
				users: result,
			});

			for (const user of result) {
				// The API can answer with `null` for a deleted user.
				if (!user?.id || users.has(user.id)) {
					continue;
				}

				users.set(user.id, user);
				metro.common.Dispatcher.dispatch({ type: 'USER_UPDATE', user });

				if (users.size >= Avatar.limit) break;
			}
		} catch (error) {
			console.error('[Reaction Avatars] Failed to fetch reactors:', error);
		}
	}

	return [...users.values()];
}

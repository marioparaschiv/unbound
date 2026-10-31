import type {
	NativeRuntimeBridge,
	NativeRuntimeEventName,
	NativeSerializableObject,
} from '@unbound-app/types';
import type { FluxAction } from '@unbound-app/types/flux';

import { NativePluginUnavailableError } from '~/native/errors';
import { Dispatcher } from '~/flux/modules';
import { onAction } from '~/flux/api';

type FluxMessage = {
	author?: { bot?: boolean; id?: string; username?: string };
	channel_id?: string;
	id?: string;
	nonce?: number | string | null;
};

type FluxEmoji = {
	animated?: boolean;
	id?: string | null;
	name?: string;
};

type FluxRuntimeEvent = FluxAction & {
	channelId?: string;
	channel_id?: string;
	emoji?: FluxEmoji | null;
	guildId?: string;
	guild_id?: string;
	hasDraft?: boolean;
	message?: FluxMessage | null;
	messageId?: string;
	message_id?: string;
	userId?: string;
	user_id?: string;
};

const runtimeEventActions: Record<NativeRuntimeEventName, readonly string[]> = {
	'message.created': ['MESSAGE_CREATE'],
	'message.updated': ['MESSAGE_UPDATE'],
	'message.deleted': ['MESSAGE_DELETE'],
	'reaction.updated': [
		'MESSAGE_REACTION_ADD',
		'MESSAGE_REACTION_REMOVE',
		'MESSAGE_REACTION_REMOVE_ALL',
		'MESSAGE_REACTION_REMOVE_EMOJI',
	],
	'channel.changed': ['CHANNEL_SELECT'],
	'composer.changed': ['DRAFT_CHANGE'],
	'ui.changed': [
		'CHANNEL_SELECT',
		'MESSAGE_CREATE',
		'MESSAGE_UPDATE',
		'MESSAGE_DELETE',
		'MESSAGE_REACTION_ADD',
		'MESSAGE_REACTION_REMOVE',
		'MESSAGE_REACTION_REMOVE_ALL',
		'MESSAGE_REACTION_REMOVE_EMOJI',
	],
};

function createRuntimeEventPayload(
	eventName: NativeRuntimeEventName,
	action: string,
	event: FluxRuntimeEvent,
): NativeSerializableObject {
	const channelId = event.channelId ?? event.channel_id ?? event.message?.channel_id;
	const guildId = event.guildId ?? event.guild_id;
	const messageId = event.messageId ?? event.message_id ?? event.message?.id;
	const userId = event.userId ?? event.user_id;
	const nonce = event.message?.nonce;
	const message: NativeSerializableObject | null = event.message
		? {
				id: event.message.id ?? null,
				channelId: event.message.channel_id ?? null,
				nonce:
					typeof nonce === 'number' && !Number.isFinite(nonce) ? null : (nonce ?? null),
				author: event.message.author
					? {
							id: event.message.author.id ?? null,
							username: event.message.author.username ?? null,
							bot: event.message.author.bot ?? null,
						}
					: null,
			}
		: null;
	const emoji: NativeSerializableObject | null = event.emoji
		? {
				id: event.emoji.id ?? null,
				name: event.emoji.name ?? null,
				animated: event.emoji.animated ?? null,
			}
		: null;

	return {
		event: eventName,
		action,
		channelId: channelId ?? null,
		guildId: guildId ?? null,
		messageId: messageId ?? null,
		userId: userId ?? null,
		hasDraft: typeof event.hasDraft === 'boolean' ? event.hasDraft : null,
		message,
		emoji,
	};
}

/**
 * @description Serves bounded runtime events from Discord's Flux dispatcher, for hosts whose loader has no event adapter.
 * @returns A runtime bridge whose subscriptions listen to the matching Flux actions.
 */
export function createFluxRuntimeBridge(): NativeRuntimeBridge {
	return {
		subscribe(eventName, listener) {
			if (!Dispatcher?.subscribe || !Dispatcher.unsubscribe) {
				throw new NativePluginUnavailableError(
					'The Discord runtime event dispatcher is unavailable.',
				);
			}

			let active = true;
			const removers = runtimeEventActions[eventName].map((action) =>
				onAction(action, (event: FluxRuntimeEvent) => {
					if (!active) return;

					listener(createRuntimeEventPayload(eventName, action, event));
				}),
			);

			return {
				get active() {
					return active;
				},
				remove() {
					if (!active) return;

					active = false;

					for (const remove of removers) {
						remove();
					}
				},
			};
		},
	};
}

export default { createFluxRuntimeBridge };

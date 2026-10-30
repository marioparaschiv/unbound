import type {
	NativeRuntimeBridge,
	NativeRuntimeEventName,
	NativeSerializableObject,
} from '@unbound-app/types';

import { NativePluginUnavailableError } from '~/api/native-errors';
import { findByPropsLazy } from '~/api/metro/wrappers';

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

type FluxRuntimeEvent = {
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

type FluxDispatcher = {
	subscribe?: (event: string, listener: (event: FluxRuntimeEvent) => void) => void;
	unsubscribe?: (event: string, listener: (event: FluxRuntimeEvent) => void) => void;
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

const fluxDispatcher = findByPropsLazy('dispatch', 'subscribe') as FluxDispatcher;

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
			const dispatcher = fluxDispatcher;

			if (!dispatcher?.subscribe || !dispatcher.unsubscribe) {
				throw new NativePluginUnavailableError(
					'The Discord runtime event dispatcher is unavailable.',
				);
			}

			let active = true;
			const subscriptions = runtimeEventActions[eventName].map((action) => {
				function callback(event: FluxRuntimeEvent): void {
					if (!active) return;

					try {
						listener(createRuntimeEventPayload(eventName, action, event));
					} catch (error) {
						console.error('Native runtime event listener failed:', error);
					}
				}

				dispatcher.subscribe?.(action, callback);

				return { action, callback };
			});

			return {
				get active() {
					return active;
				},
				remove() {
					if (!active) return;

					active = false;

					for (const { action, callback } of subscriptions) {
						dispatcher.unsubscribe?.(action, callback);
					}
				},
			};
		},
	};
}

export default { createFluxRuntimeBridge };

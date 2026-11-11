import type {
	NativeRuntimeBridge,
	NativeRuntimeEventName,
	NativeSerializableObject,
} from '@unbound-app/types';
import type { FluxAction } from '@unbound-app/types/flux';
import { createLogger } from '@unbound-app/logger';

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
					? Object.freeze({
							id: event.message.author.id ?? null,
							username: event.message.author.username ?? null,
							bot: event.message.author.bot ?? null,
						})
					: null,
			}
		: null;
	const emoji: NativeSerializableObject | null = event.emoji
		? Object.freeze({
				id: event.emoji.id ?? null,
				name: event.emoji.name ?? null,
				animated: event.emoji.animated ?? null,
			})
		: null;

	return Object.freeze({
		event: eventName,
		action,
		channelId: channelId ?? null,
		guildId: guildId ?? null,
		messageId: messageId ?? null,
		userId: userId ?? null,
		hasDraft: typeof event.hasDraft === 'boolean' ? event.hasDraft : null,
		message: message && Object.freeze(message),
		emoji,
	});
}

type RuntimeEventListener = (payload: NativeSerializableObject) => void;

type ActionSubscription = {
	remove: () => void;
	listeners: Map<NativeRuntimeEventName, Set<RuntimeEventListener>>;
};

const Logger = createLogger('Flux');
const actionSubscriptions = new Map<string, ActionSubscription>();

function notifyListeners(
	eventName: NativeRuntimeEventName,
	action: string,
	event: FluxRuntimeEvent,
	listeners: Set<RuntimeEventListener>,
) {
	if (!listeners.size) return;

	const payload = createRuntimeEventPayload(eventName, action, event);

	for (const listener of listeners) {
		try {
			listener(payload);
		} catch (error) {
			Logger.error(`Failed to run a ${action} listener:`, error);
		}
	}
}

function subscribeAction(action: string): ActionSubscription {
	const existing = actionSubscriptions.get(action);

	if (existing) {
		return existing;
	}

	const listeners = new Map<NativeRuntimeEventName, Set<RuntimeEventListener>>();
	const remove = onAction(action, (event: FluxRuntimeEvent) => {
		for (const [eventName, eventListeners] of listeners) {
			notifyListeners(eventName, action, event, eventListeners);
		}
	});
	const subscription = { remove, listeners };

	actionSubscriptions.set(action, subscription);

	return subscription;
}

function addActionListener(
	action: string,
	eventName: NativeRuntimeEventName,
	listener: RuntimeEventListener,
) {
	const subscription = subscribeAction(action);
	const listeners = subscription.listeners.get(eventName) ?? new Set();

	listeners.add(listener);
	subscription.listeners.set(eventName, listeners);
}

function removeActionListener(
	action: string,
	eventName: NativeRuntimeEventName,
	listener: RuntimeEventListener,
) {
	const subscription = actionSubscriptions.get(action);
	const listeners = subscription?.listeners.get(eventName);

	if (!subscription || !listeners?.delete(listener)) return;

	if (!listeners.size) {
		subscription.listeners.delete(eventName);
	}

	if (subscription.listeners.size) return;

	actionSubscriptions.delete(action);
	subscription.remove();
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
			const actions = runtimeEventActions[eventName];
			const subscriber: RuntimeEventListener = (payload) => {
				if (active) {
					listener(payload);
				}
			};

			for (const action of actions) {
				addActionListener(action, eventName, subscriber);
			}

			return {
				get active() {
					return active;
				},
				remove() {
					if (!active) return;

					active = false;

					for (const action of actions) {
						removeActionListener(action, eventName, subscriber);
					}
				},
			};
		},
	};
}

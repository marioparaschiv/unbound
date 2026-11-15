import type { PluginContext } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { flux, metro } from '@unbound-app/api';

import {
	delivered,
	keepAlive,
	notificationId,
	permission,
	post,
	type NotificationTarget,
} from '~/native/local';
import { tappedTarget, type Posted } from '~/lib/opened';
import { notificationText } from '~/lib/notification-text';
import { shouldNotify } from '~/lib/should-notify';

type RawMessage = {
	id?: string;
	content?: string;
	channel_id?: string;
	guild_id?: string;
	attachments?: unknown[];
	author?: { id?: string; username?: string; global_name?: string | null };
	member?: { nick?: string | null };
};
type GuildSettings = {
	isChannelMuted?(guildId: string | null, channelId: string): boolean;
	isSuppressEveryoneEnabled?(guildId: string): boolean;
	isSuppressRolesEnabled?(guildId: string): boolean;
};

const DIRECT_TYPES = new Set([1, 3]);
const Mentions = metro.findByProps('isRawMessageMentioned', { lazy: true });

let running: { stop(): void } | undefined;
let posted: Posted<NotificationTarget>[] = [];
const MAX_TRACKED = 50;
let stopListening: (() => void) | undefined;
let subscription: { remove(): void } | undefined;

function pushWorks(): boolean {
	const push = globalThis.NativePlatform?.device?.getState?.()?.push;

	return Boolean(push?.registered);
}

function isActive(): boolean {
	return metro.common.ReactNative.AppState.currentState === 'active';
}

function mentioned(message: RawMessage, userId: string, guildSettings: GuildSettings): boolean {
	const guildId = message.guild_id;

	return Boolean(
		Mentions?.isRawMessageMentioned({
			rawMessage: message,
			userId,
			suppressEveryone: guildId
				? Boolean(guildSettings.isSuppressEveryoneEnabled?.(guildId))
				: false,
			suppressRoles: guildId
				? Boolean(guildSettings.isSuppressRolesEnabled?.(guildId))
				: false,
		}),
	);
}

function onMessage(context: PluginContext, action: { message?: RawMessage; optimistic?: boolean }) {
	const message = action.message;
	const me = flux.getStore('User').getCurrentUser()?.id;
	const channelId = message?.channel_id;

	if (!message?.id || !me || !channelId) return;

	const channel = flux.getStore('Channel').getChannel(channelId) as
		| { type?: number; name?: string }
		| undefined;
	const guildSettings = flux.getStore('UserGuildSettings') as unknown as GuildSettings;
	const notify = shouldNotify(
		{
			fromMe: message.author?.id === me,
			optimistic: Boolean(action.optimistic),
			mentioned: mentioned(message, me, guildSettings),
			direct: DIRECT_TYPES.has(channel?.type ?? -1),
			muted: Boolean(guildSettings.isChannelMuted?.(message.guild_id ?? null, channelId)),
			active: isActive(),
		},
		settings,
	);

	if (!notify) return;

	const guild = message.guild_id
		? (flux.getStore('Guild').getGuild(message.guild_id) as { name?: string } | undefined)
		: undefined;
	const text = notificationText(
		{
			author:
				message.member?.nick ??
				message.author?.global_name ??
				message.author?.username ??
				'',
			channel: message.guild_id ? channel?.name : undefined,
			guild: guild?.name,
			content: message.content ?? '',
			attachments: message.attachments?.length ?? 0,
		},
		{ attachment: messages.ATTACHMENT, hidden: messages.NEW_MESSAGE },
		settings.preview,
	);

	try {
		const target = { channelId, guildId: message.guild_id, messageId: message.id };

		post(context.native, text, target);
		posted = [...posted, { id: notificationId(message.id), target }].slice(-MAX_TRACKED);
	} catch (error) {
		logger.error(`Failed to post a notification for message ${message.id}:`, error);
	}
}

function open({ channelId, guildId, messageId }: NotificationTarget) {
	metro
		.findByProps('transitionToGuild')
		?.transitionTo(`/channels/${guildId ?? '@me'}/${channelId}/${messageId}`);
}

function onAppState(context: PluginContext, status: string) {
	if (status === 'active') {
		running?.stop();
		running = undefined;

		if (posted.length) {
			void delivered(context.native)
				.then((ids) => {
					const { target, remaining } = tappedTarget(posted, ids);

					posted = remaining;

					if (target) open(target);
				})
				.catch((error: unknown) =>
					logger.error('Failed to check which notification was opened:', error),
				);
		}

		return;
	}

	if (status === 'background' && !running && (settings.mode === 'always' || !pushWorks())) {
		try {
			running = keepAlive(context.native);
		} catch (error) {
			logger.error('Failed to keep Discord running in the background:', error);
		}
	}
}

export function start(context: PluginContext) {
	permission(context.native);

	stopListening = flux.onAction('MESSAGE_CREATE', (action) =>
		onMessage(context, action as Parameters<typeof onMessage>[1]),
	);
	subscription = metro.common.ReactNative.AppState.addEventListener('change', (status: string) =>
		onAppState(context, status),
	);
}

export function stop() {
	posted = [];
	subscription?.remove();
	subscription = undefined;
	stopListening?.();
	stopListening = undefined;
	running?.stop();
	running = undefined;
}

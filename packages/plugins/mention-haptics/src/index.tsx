import { settings } from '@unbound-app/settings';
import { flux, metro } from '@unbound-app/api';

import { shouldTap } from '~/lib/should-tap';

type GuildSettings = {
	isSuppressEveryoneEnabled?(guildId: string): boolean;
	isSuppressRolesEnabled?(guildId: string): boolean;
};
type RawMessage = { author?: { id?: string }; channel_id?: string; guild_id?: string };

const Haptics = metro.findByProps('triggerHapticFeedback', { lazy: true });
const Mentions = metro.findByProps('isRawMessageMentioned', { lazy: true });
const IMPACTS = { light: 'IMPACT_LIGHT', medium: 'IMPACT_MEDIUM', heavy: 'IMPACT_HEAVY' } as const;
const DIRECT_TYPES = new Set([1, 3]);

let stopListening: (() => void) | undefined;

function mentioned(message: RawMessage, userId: string): boolean {
	const guildId = message.guild_id;
	const guildSettings = flux.getStore('UserGuildSettings') as unknown as GuildSettings;

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

function onMessage(action: { message?: RawMessage; optimistic?: boolean }) {
	const message = action.message;
	const me = flux.getStore('User').getCurrentUser()?.id;
	const channelId = message?.channel_id;

	if (!message || !me || !channelId || !Haptics) return;

	const channel = flux.getStore('Channel').getChannel(channelId) as { type?: number } | undefined;
	const tap = shouldTap(
		{
			fromMe: message.author?.id === me,
			mentioned: mentioned(message, me),
			direct: DIRECT_TYPES.has(channel?.type ?? -1),
			open: flux.getStore('SelectedChannel').getChannelId() === channelId,
			optimistic: Boolean(action.optimistic),
		},
		settings,
	);

	if (tap)
		Haptics.triggerHapticFeedback?.(
			Haptics.HapticFeedbackTypes?.[IMPACTS[settings.strength]] ?? 1,
		);
}

export function start() {
	stopListening = flux.onAction('MESSAGE_CREATE', (action) =>
		onMessage(action as Parameters<typeof onMessage>[0]),
	);
}

export function stop() {
	stopListening?.();
	stopListening = undefined;
}

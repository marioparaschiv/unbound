import { flux } from '@unbound-app/api';
import { format } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import { narrationFor, type Narration, type VoiceStateUpdate } from '~/lib/narration';

const STAGE_CHANNEL = 13;

const ChannelStore = flux.getStore('Channel');
const GuildMemberStore = flux.getStore('GuildMember');
const SelectedChannelStore = flux.getStore('SelectedChannel');
const UserStore = flux.getStore('User');

type VoiceStatesAction = { voiceStates?: (VoiceStateUpdate & { guildId?: string | null })[] };

function announced({ event, self }: Narration): boolean {
	if (self) return settings.announce.yourself;
	if (event === 'join') return settings.announce.joins;
	if (event === 'leave') return settings.announce.leaves;

	return settings.announce.moves;
}

function userName(userId: string, guildId: string | null | undefined): string {
	const user = UserStore.getUser(userId);
	const nick = guildId ? GuildMemberStore.getNick?.(guildId, userId) : undefined;

	return nick ?? user?.globalName ?? user?.username ?? userId;
}

function line(narration: Narration, userId: string, guildId: string | null | undefined): string {
	const channel = ChannelStore.getChannel(narration.channelId)?.name ?? '';
	const user = userName(userId, guildId);

	if (narration.self) {
		if (narration.event === 'join') return format('YOU_JOINED', { channel });
		if (narration.event === 'leave') return format('YOU_LEFT', { channel });

		return format('YOU_MOVED', { channel });
	}

	if (narration.event === 'join') return format('JOINED', { user });
	if (narration.event === 'leave') return format('LEFT', { user });

	return format('MOVED', { user, channel });
}

/**
 * @description Speaks joins, leaves and moves through the listener's voice channel as `VOICE_STATE_UPDATES` arrive. Stage channels stay quiet.
 * @param speak Speaks a line aloud.
 */
export function listenToVoiceStates(speak: (text: string) => void): void {
	flux.onAction('VOICE_STATE_UPDATES', (action) => {
		const { voiceStates = [] } = action as VoiceStatesAction;
		const me = {
			id: UserStore.getCurrentUser()?.id ?? '',
			channelId: SelectedChannelStore.getVoiceChannelId(),
		};

		if (me.channelId && ChannelStore.getChannel(me.channelId)?.type === STAGE_CHANNEL) return;

		for (const state of voiceStates) {
			const narration = narrationFor(state, me);

			if (!narration || !announced(narration)) continue;

			try {
				speak(line(narration, state.userId, state.guildId));
			} catch (error) {
				logger.error(`Failed to announce voice update for ${state.userId}:`, error);
			}
		}
	});
}

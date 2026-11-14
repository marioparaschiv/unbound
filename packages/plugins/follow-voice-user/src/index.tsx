import { commands, flux, metro } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { format, messages } from '@unbound-app/i18n';

import { followStep, type Followed, type VoiceUpdate } from '~/lib/follow';

type VoiceActions = { selectVoiceChannel(channelId: string | null): void };
type VoiceStates = {
	getVoiceStateForUser(userId: string): { channelId?: string | null } | undefined;
};
type Relationships = { isFriend(userId: string): boolean };

const VoiceChannels: VoiceActions | undefined = metro.findByProps('selectVoiceChannel', {
	lazy: true,
});

let followed: Followed | undefined;
let stopListening: (() => void) | undefined;

function voiceStates(): VoiceStates {
	return flux.getStore('VoiceState') as unknown as VoiceStates;
}

function myChannel(): string | null {
	const me = flux.getStore('User').getCurrentUser()?.id;

	return (me && voiceStates().getVoiceStateForUser(me)?.channelId) || null;
}

function onVoiceUpdates(updates: readonly VoiceUpdate[]) {
	if (!followed || !VoiceChannels) return;

	const step = followStep(followed, updates, {
		onlyWhenInVoice: settings.onlyWhenInVoice,
		inVoice: Boolean(myChannel()),
		leaveWithThem: settings.leaveWithThem,
	});

	if (step && 'join' in step) {
		followed = { ...followed, channelId: step.join };
		VoiceChannels.selectVoiceChannel(step.join);
	} else if (step) {
		followed = { ...followed, channelId: null };
		VoiceChannels.selectVoiceChannel(null);
	}
}

export function start() {
	stopListening = flux.onAction('VOICE_STATE_UPDATES', (action) => {
		const { voiceStates = [] } = action as { voiceStates?: VoiceUpdate[] };

		onVoiceUpdates(voiceStates);
	});
	commands.register({
		follow: {
			description: 'FOLLOW_DESC',
			options: {
				user: commands.option.user({ description: 'FOLLOW_USER_DESC', required: true }),
			},
			execute: ({ user }) => {
				const relationships = flux.getStore('Relationship') as unknown as Relationships;

				if (!relationships.isFriend(user.id))
					return { ephemeral: true, content: messages.NOT_A_FRIEND };

				const name = user.globalName ?? user.username;
				const channelId = voiceStates().getVoiceStateForUser(user.id)?.channelId ?? null;

				followed = { userId: user.id, name, channelId: null };
				onVoiceUpdates(channelId ? [{ userId: user.id, channelId }] : []);

				return { ephemeral: true, content: format('FOLLOWING', { name }) };
			},
		},
		unfollow: {
			description: 'UNFOLLOW_DESC',
			execute: () => {
				const name = followed?.name;

				followed = undefined;

				return {
					ephemeral: true,
					content: name ? format('UNFOLLOWED', { name }) : messages.NOT_FOLLOWING,
				};
			},
		},
	});
}

export function stop() {
	stopListening?.();
	stopListening = undefined;
	followed = undefined;
}

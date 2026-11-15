import { parseIdList } from '@unbound-plugins/shared/entities/id-list';
import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { joinedUsers, type VoiceStateUpdate } from '~/lib/joins';
import { playJoinSound } from '~/lib/play';
import SettingsPanel from '~/settings';

export { SettingsPanel };

type VoiceStateStore = {
	getVoiceStateForUser(userId: string): { channelId?: string | null } | undefined;
};

let stopListening: (() => void) | undefined;

export function start() {
	const VoiceStates = flux.getStore('VoiceState') as unknown as VoiceStateStore;
	const SelectedChannels = flux.getStore('SelectedChannel');
	const Users = flux.getStore('User');

	stopListening = flux.interceptAction('VOICE_STATE_UPDATES', (action) => {
		try {
			const joined = joinedUsers(
				(action as { voiceStates?: VoiceStateUpdate[] }).voiceStates ?? [],
				SelectedChannels?.getVoiceChannelId?.() ?? undefined,
				(userId) => VoiceStates.getVoiceStateForUser?.(userId)?.channelId,
				new Set(parseIdList(settings.users)),
				Users?.getCurrentUser?.()?.id,
			);

			if (joined.length) playJoinSound();
		} catch (error) {
			logger.error('Failed to check a voice state update for joins:', error);
		}

		return false;
	});
}

export function stop() {
	stopListening?.();
	stopListening = undefined;
}

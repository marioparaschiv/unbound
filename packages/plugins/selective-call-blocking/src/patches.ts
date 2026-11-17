import { parseIdList } from '@unbound-plugins/shared/entities/id-list';
import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import {
	isSilenced,
	ringsSelf,
	stopRingingSelf,
	type CallAction,
	type CallChannel,
} from '~/lib/silence';

const CALL_ACTIONS = ['CALL_CREATE', 'CALL_UPDATE'] as const;

function currentRules() {
	return {
		users: new Set(parseIdList(settings.users)),
		groups: new Set(parseIdList(settings.groups)),
	};
}

/**
 * @description Stops calls from picked users and group DMs ringing by taking the current user out of their rings
 * before Discord reads it. Everyone else in the call still rings.
 * @returns A function that lets those calls ring again.
 */
export function silenceCalls(): () => void {
	const Users = flux.getStore('User');
	const Channels = flux.getStore('Channel');
	const stops = CALL_ACTIONS.map((type) =>
		flux.interceptAction(type, (raw) => {
			const action = raw as CallAction;
			const selfId = Users.getCurrentUser?.()?.id;

			if (!selfId || !action.channelId || !ringsSelf(action, selfId)) return;

			const channel = Channels.getChannel(action.channelId) as CallChannel | undefined;

			if (isSilenced(channel, currentRules())) stopRingingSelf(action, selfId);
		}),
	);

	return () => {
		for (const stop of stops) stop();
	};
}

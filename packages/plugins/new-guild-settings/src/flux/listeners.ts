import { flux, metro, patcher } from '@unbound-app/api';

import {
	approvedRequestGuildId,
	createRepeatGuard,
	inviteGuildId,
	memberJoinGuildId,
	type InviteAcceptAction,
	type JoinGuildOptions,
	type JoinRequestAction,
} from '~/lib/join-events';
import { applyNewGuildSettings } from '~/lib/apply';
import { NotificationSettings } from '~/lib/modules';
import { REPEAT_WINDOW_MS } from '~/lib/constants';

type GuildActions = {
	joinGuild: (guildId: unknown, options?: JoinGuildOptions) => unknown;
};

const UserStore = flux.getStore('User');

/**
 * @description Applies the plugin's defaults to every server the user joins, on the three paths Vencord covers.
 * Listens for `INVITE_ACCEPT_SUCCESS` (invites, where Vencord patches `acceptInvite`) and `GUILD_JOIN_REQUEST_UPDATE` with an approved request for the signed-in user from `UserStore`,
 * and patches `joinGuild` on Discord's guild actions module (`joinGuild`, `waitForGuild`) to apply after a non-lurking join resolves.
 * A server reported by more than one path within ten seconds is changed once, so the three share one repeat guard.
 */
export function listenToJoins(): void {
	if (!NotificationSettings) {
		logger.warn('Joins skipped: Discord moved updateGuildNotificationSettings.');

		return;
	}

	const isFirst = createRepeatGuard(REPEAT_WINDOW_MS);

	function applyOnce(guildId: string | undefined) {
		if (guildId && isFirst(guildId)) applyNewGuildSettings(guildId);
	}

	flux.onAction('INVITE_ACCEPT_SUCCESS', (action) =>
		applyOnce(inviteGuildId(action as InviteAcceptAction)),
	);

	flux.onAction('GUILD_JOIN_REQUEST_UPDATE', (action) =>
		applyOnce(
			approvedRequestGuildId(action as JoinRequestAction, UserStore.getCurrentUser()?.id),
		),
	);

	const GuildActions: GuildActions | undefined = metro.findByProps('joinGuild', 'waitForGuild');

	if (!GuildActions) {
		logger.warn('Direct joins skipped: Discord moved joinGuild.');

		return;
	}

	patcher.after(GuildActions, 'joinGuild', ({ args: [guildId, options], result }) => {
		const joined = memberJoinGuildId(guildId, options);

		if (!joined) return;

		Promise.resolve(result).then(
			() => applyOnce(joined),
			() => undefined,
		);
	});
}

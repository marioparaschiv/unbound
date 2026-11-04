import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import { flux, patcher } from '@unbound-app/api';

import {
	approvedRequestGuildId,
	createRepeatGuard,
	inviteGuildId,
	memberJoinGuildId,
	type InviteAcceptAction,
	type JoinRequestAction,
} from '~/joins/join-events';
import { GuildActions, UserStore } from '~/joins/modules';
import { applyNewGuildSettings } from '~/apply';
import { REPEAT_WINDOW_MS } from '~/constants';

/**
 * @description Applies the plugin's defaults to every server the user joins, on the three paths Vencord covers.
 * Listens for `INVITE_ACCEPT_SUCCESS` (invites, where Vencord patches `acceptInvite`) and `GUILD_JOIN_REQUEST_UPDATE` with an approved request for the signed-in user from `UserStore`,
 * and patches `joinGuild` on Discord's guild actions module (`joinGuild`, `waitForGuild`) to apply after a non-lurking join resolves.
 * A server reported by more than one path within ten seconds is changed once.
 * The Addon scope removes the listeners and the patch when the plugin stops.
 */
export function startJoins(): void {
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

	patcher.after(GuildActions, 'joinGuild', ({ args: [guildId, options], result }) => {
		const joined = memberJoinGuildId(guildId, options);

		if (!joined) return;

		Promise.resolve(result).then(
			() => applyOnce(joined),
			() => undefined,
		);
	});

	recordApplied(3);
}

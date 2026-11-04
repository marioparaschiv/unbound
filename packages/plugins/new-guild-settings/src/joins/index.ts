import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { flux, metro, patcher } from '@unbound-app/api';

import {
	approvedRequestGuildId,
	createRepeatGuard,
	inviteGuildId,
	memberJoinGuildId,
	type InviteAcceptAction,
	type JoinGuildOptions,
	type JoinRequestAction,
} from '~/joins/join-events';
import { PLUGIN_NAME, REPEAT_WINDOW_MS } from '~/constants';
import { applyNewGuildSettings } from '~/apply';

type GuildActions = {
	joinGuild: (guildId: unknown, options?: JoinGuildOptions) => unknown;
};

const UserStore = flux.getStore('User', { lazy: true });
const GuildActionsFilter = metro.filters.byProps('joinGuild', 'waitForGuild');

function patchJoinGuild(applyOnce: (guildId: string | undefined) => void): () => void {
	return whenLoaded<GuildActions>(GuildActionsFilter, (GuildActions) => {
		if (typeof GuildActions.joinGuild !== 'function') return;

		return patcher.after(GuildActions, 'joinGuild', ({ args: [guildId, options], result }) => {
			const joined = memberJoinGuildId(guildId, options);

			if (!joined) return;

			Promise.resolve(result).then(
				() => applyOnce(joined),
				() => undefined,
			);
		});
	});
}

/**
 * @description Applies the plugin's defaults to every server the user joins, on the three paths Vencord covers.
 * Listens for `INVITE_ACCEPT_SUCCESS` (invites, where Vencord patches `acceptInvite`) and `GUILD_JOIN_REQUEST_UPDATE` with an approved request for the signed-in user from `UserStore`,
 * and patches `joinGuild` on Discord's guild actions module (`joinGuild`, `waitForGuild`) to apply after a non-lurking join resolves.
 * A server reported by more than one path within ten seconds is changed once.
 * @returns A function that removes the listeners and the patch.
 */
export function applyOnJoin(): () => void {
	const isFirst = createRepeatGuard(REPEAT_WINDOW_MS);

	function applyOnce(guildId: string | undefined) {
		if (guildId && isFirst(guildId)) applyNewGuildSettings(guildId);
	}

	return applyFeatures(`${PLUGIN_NAME}: joins`, [
		() =>
			flux.onAction('INVITE_ACCEPT_SUCCESS', (action) =>
				applyOnce(inviteGuildId(action as InviteAcceptAction)),
			),
		() =>
			flux.onAction('GUILD_JOIN_REQUEST_UPDATE', (action) =>
				applyOnce(
					approvedRequestGuildId(
						action as JoinRequestAction,
						UserStore.getCurrentUser()?.id,
					),
				),
			),
		() => patchJoinGuild(applyOnce),
	]);
}

export default applyOnJoin;

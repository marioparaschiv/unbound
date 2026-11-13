import { commands, metro } from '@unbound-app/api';

import { describeCreated, describeList, type FriendInvite } from '~/lib/invites';

type InviteActions = {
	createFriendInvite(): Promise<FriendInvite>;
	getAllFriendInvites(): Promise<FriendInvite[]>;
	revokeFriendInvites(): Promise<unknown>;
};

function isInviteActions(module: unknown): module is InviteActions {
	return typeof (module as Partial<InviteActions> | undefined)?.createFriendInvite === 'function';
}

/**
 * @description Adds `/friend-invites` with `create`, `view` and `revoke`, answering only to the user.
 * Calls `createFriendInvite`, `getAllFriendInvites` and `revokeFriendInvites` on Discord's invite actions.
 */
export function registerFriendInvites(): void {
	const Invites: unknown = metro.findByProps('createFriendInvite', 'getAllFriendInvites');

	if (!isInviteActions(Invites)) {
		logger.warn('Friend invites skipped: Discord moved its invite actions.');

		return;
	}

	commands.register({
		'friend-invites': {
			description: 'FRIEND_INVITES_DESC',
			subcommands: {
				create: {
					description: 'CREATE_DESC',
					execute: async () => ({
						ephemeral: true,
						content: describeCreated(await Invites.createFriendInvite()),
					}),
				},
				view: {
					description: 'VIEW_DESC',
					execute: async () => ({
						ephemeral: true,
						content: describeList(await Invites.getAllFriendInvites()),
					}),
				},
				revoke: {
					description: 'REVOKE_DESC',
					execute: async () => {
						await Invites.revokeFriendInvites();

						return { ephemeral: true, content: 'All friend invites were revoked.' };
					},
				},
			},
		},
	});
}

import { guardSends, type SendArgs } from '@unbound-plugins/shared/composer/held-send';
import { dialogs, flux, metro } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import {
	countMentions,
	needsConfirmation,
	type MentionCounts,
	type MentionLimits,
} from '~/lib/mentions';

type PermissionStore = { can(permission: unknown, channel: unknown): boolean };

type ChannelStore = { getChannel(channelId: string): unknown };

function canPingEveryone(channelId: string): boolean {
	const permission = metro.common.Constants?.Permissions?.MENTION_EVERYONE;
	const channel = (flux.getStore('Channel') as unknown as ChannelStore).getChannel(channelId);

	if (permission === undefined || !channel) return true;

	return Boolean(
		(flux.getStore('Permission') as unknown as PermissionStore).can(permission, channel),
	);
}

function pingBody(counts: MentionCounts, limits: MentionLimits) {
	const manyUsers = counts.users >= limits.users;
	const manyRoles = counts.roles >= limits.roles;
	const users = String(counts.users);
	const roles = String(counts.roles);

	if (manyUsers && manyRoles) {
		return { body: 'CONFIRM_MANY', bodyVars: { users, roles } } as const;
	}

	return manyUsers
		? ({ body: 'CONFIRM_USERS', bodyVars: { users } } as const)
		: ({ body: 'CONFIRM_ROLES', bodyVars: { roles } } as const);
}

function confirmPing(counts: MentionCounts, limits: MentionLimits): Promise<boolean> {
	const buttons = { confirm: 'CONFIRM_SEND', cancel: 'CONFIRM_EDIT', destructive: true } as const;

	if (limits.broad) {
		return dialogs.confirm('CONFIRM_TITLE', {
			body: 'CONFIRM_BROAD',
			bodyVars: { mentions: counts.broad.join(', ') },
			...buttons,
		});
	}

	return dialogs.confirm('CONFIRM_TITLE', { ...pingBody(counts, limits), ...buttons });
}

async function guardPing([channelId, message]: SendArgs): Promise<boolean> {
	const counts = countMentions(message.content);
	const broad = counts.broad.length > 0 && settings.everyone && canPingEveryone(channelId);
	const limits = { broad, users: settings.users, roles: settings.roles };

	if (!needsConfirmation(counts, limits)) return true;

	return confirmPing(counts, limits);
}

/**
 * @description Asks before sending a message that pings @everyone, @here, or at least the set number of people or
 * roles, and puts a cancelled message back in the chat input.
 */
export function patchSends(): void {
	guardSends('Mention Guard', guardPing);
}

export default { patchSends };

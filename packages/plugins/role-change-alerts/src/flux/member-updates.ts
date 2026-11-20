import { settings } from '@unbound-app/settings';
import { format } from '@unbound-app/i18n';
import { flux } from '@unbound-app/api';

import { GuildMemberStore, GuildRoleStore, GuildStore, UserStore } from '~/lib/modules';
import { guildIconURL, notify } from '~/lib/notify';
import { roleChanges } from '~/lib/role-changes';

type MemberUpdate = { guildId?: string; user?: { id?: string }; roles?: string[] };

type Describe = (values: { role: string; server: string }) => string;

const describeGained: Describe = (values) => format('ROLE_GAINED', values);
const describeLost: Describe = (values) => format('ROLE_LOST', values);

function announce(guildId: string, roleIds: string[], describe: Describe) {
	const guild = GuildStore.getGuild(guildId);
	const server = guild?.name ?? guildId;
	const iconURL = guildIconURL(guildId, guild?.icon);

	for (const roleId of roleIds) {
		const role = GuildRoleStore.getRole?.(guildId, roleId)?.name ?? roleId;

		notify(describe({ role, server }), iconURL);
	}
}

/**
 * @description Notifies about the roles a server gives or takes from the signed-in user, read before Discord stores the update so the old roles are still there.
 * Intercepts `GUILD_MEMBER_UPDATE` without blocking it.
 */
export function watchRoleChanges(): void {
	flux.interceptAction('GUILD_MEMBER_UPDATE', (action) => {
		const { guildId, user, roles } = action as MemberUpdate;
		const me = UserStore.getCurrentUser()?.id;

		if (!guildId || !me || user?.id !== me || !Array.isArray(roles)) return false;

		const before = GuildMemberStore.getMember(guildId, me)?.roles;

		if (!Array.isArray(before)) return false;

		const { gained, lost } = roleChanges(before, roles);

		if (settings.gained) announce(guildId, gained, describeGained);
		if (settings.lost) announce(guildId, lost, describeLost);

		return false;
	});
}

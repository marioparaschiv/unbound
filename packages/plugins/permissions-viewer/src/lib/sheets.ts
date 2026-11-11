import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';

import MemberPermissionsSheet from '~/components/member-permissions-sheet';
import PermissionsSheet from '~/components/permissions-sheet';
import { memberView, viewForTarget, type PermissionsView } from '~/lib/views';
import type { Target } from '~/lib/sheet-targets';
import { GuildStore } from '~/lib/modules';
import type { Guild } from '~/lib/types';

/**
 * @description Opens the sheet listing a member's roles, a channel's overwrites or a server's roles, with what each allows and denies.
 * Opens through `ActionSheets.openLazy`. The sheet reads roles from `GuildRoleStore` (`getSortedRoles`, `getRolesSnapshot`, `getRole`), flags from `Constants.Permissions`, titles and descriptions from `getGuildPermissionSpecMap` when Discord ships it, and dispatches `GUILD_MEMBERS_REQUEST` for overwrite members `GuildMemberStore` lacks.
 * @param view What to list.
 */
export function openPermissionsSheet(view: PermissionsView): void {
	openSheet(`unbound-permissions-viewer-${Date.now()}`, PermissionsSheet, { view });
}

/**
 * @description Opens the sheet listing each permission a member has and the role that grants it.
 * @param guildId The server.
 * @param userId The member's user ID.
 */
export function openMemberPermissionsSheet(guildId: string, userId: string): void {
	const guild = GuildStore.getGuild(guildId) as Guild | undefined;

	if (!guild) return;

	openSheet(`unbound-permissions-viewer-member-${Date.now()}`, MemberPermissionsSheet, {
		guild,
		userId,
		onRoleDetails: () => {
			const view = memberView(guild, userId);

			if (view) openPermissionsSheet(view);
		},
	});
}

/**
 * @description Opens what a View Permissions row shows for its target: a member's granted permissions, or the full list for a channel or server.
 * @param target The member, channel or server.
 */
export function openTarget(target: Target): void {
	if (target.kind === 'member') {
		openMemberPermissionsSheet(target.guildId, target.userId);

		return;
	}

	const view = viewForTarget(target);

	if (view) openPermissionsSheet(view);
}

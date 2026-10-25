import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { InvitePermissions, Patcher } from '~/modules';

/**
 * @description Shows the Pause Invites setting in Server Settings to every member, not only to moderators.
 * @returns A function that removes the patch.
 */
export function patchInvitePermissions(): () => void {
	if (!ensureModules('Show Hidden Things: paused invites', { InvitePermissions })) {
		return () => {};
	}

	return Patcher.after(InvitePermissions, 'useInvitesDisabledPermission', () => true);
}

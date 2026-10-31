import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { InvitePermissions } from '~/modules';

/**
 * @description Shows the Pause Invites setting in Server Settings to every member, not only to moderators.
 * @returns A function that removes the patch.
 */
export function patchInvitePermissions(): () => void {
	if (!ensureModules('Show Hidden Things: paused invites', { InvitePermissions })) {
		return () => {};
	}

	return patcher.after(InvitePermissions, 'useInvitesDisabledPermission', () => true);
}

import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';

import { InvitePermissions } from '~/invites/modules';

/**
 * @description Shows the Pause Invites setting in Server Settings to every member, not only to moderators.
 * Patches `useInvitesDisabledPermission` on Discord's invite permissions module, and does nothing while
 * `showInvitesPaused` is off. The Addon scope removes the patch when the plugin stops.
 */
export function startInvitePermissions(): void {
	if (!ensureModules('Show Hidden Things: paused invites', { InvitePermissions })) return;

	patcher.after(InvitePermissions, 'useInvitesDisabledPermission', ({ result }) =>
		settings.showInvitesPaused ? true : result,
	);

	recordApplied(1);
}

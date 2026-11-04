import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { patchInvitePermissions } from '~/patches/invite-permissions';
import { patchTimeoutIcons } from '~/patches/message-row-data';
import SettingsPanel from '~/components/settings-panel';
import { settings } from '~/modules';

export function start() {
	applyFeatures('Show Hidden Things', [
		() => whileEnabled(settings, 'showTimeouts', true, patchTimeoutIcons),
		() => whileEnabled(settings, 'showInvitesPaused', true, patchInvitePermissions),
	]);
}

export { featureSelfTest as selfTest, SettingsPanel };

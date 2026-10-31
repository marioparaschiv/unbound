import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { patchInvitePermissions } from '~/patches/invite-permissions';
import { patchTimeoutIcons } from '~/patches/message-row-data';
import SettingsPanel from '~/components/settings-panel';
import { settings } from '~/modules';

function start() {
	applyFeatures('Show Hidden Things', [
		() => whileEnabled(settings, 'showTimeouts', true, patchTimeoutIcons),
		() => whileEnabled(settings, 'showInvitesPaused', true, patchInvitePermissions),
	]);
}

export default {
	start,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};

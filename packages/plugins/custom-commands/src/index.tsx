import { featureSelfTest, recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import SettingsPanel from '~/components/settings-panel';
import { patchCommands } from '~/patches/commands';
import { Commands, Messages } from '~/modules';

export function start() {
	if (!ensureModules('Custom Commands', { Commands, Messages })) return;

	patchCommands();
	recordApplied(1);
}

export { featureSelfTest as selfTest, SettingsPanel };

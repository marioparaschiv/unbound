import { patcher } from '@unbound-app/api';

import { normalizeStoredRules } from '~/lib/stored-rules';
import SettingsPanel from '~/components/settings-panel';
import { selfTest } from '~/lib/self-test';
import { patchMessages } from '~/patches';

export function start() {
	normalizeStoredRules();
	patchMessages();
}

export function stop() {
	patcher.unpatchAll();
}

export { selfTest, SettingsPanel };

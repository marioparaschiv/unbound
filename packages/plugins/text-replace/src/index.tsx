import { replaceSelfTest, startReplace } from '~/replace';
import SettingsPanel from '~/components/settings-panel';

export function start() {
	startReplace();
}

export { replaceSelfTest as selfTest, SettingsPanel };

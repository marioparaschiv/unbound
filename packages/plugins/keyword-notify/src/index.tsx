import { interceptKeywordMessages } from '~/flux/interceptors';
import SettingsPanel from '~/settings';

export function start() {
	interceptKeywordMessages();
}

export { SettingsPanel };

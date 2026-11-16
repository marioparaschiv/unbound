import { interceptKeywordMessages } from '~/flux/interceptors';
import { interceptInbox } from '~/flux/inbox';
import SettingsPanel from '~/settings';

export function start() {
	interceptKeywordMessages();
	interceptInbox();
}

export { SettingsPanel };

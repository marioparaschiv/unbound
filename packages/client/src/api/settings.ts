import type { SettingsEntry } from '@unbound-app/types/api/settings';
import { createLogger } from '~/structures/logger';
import { DispatchTypes } from '~/lib/constants';
import { Dispatcher } from '~/api/metro/common';
import { data } from '~/built-ins/settings';


export type * from '@unbound-app/types/api/settings';

const Logger = createLogger('API', 'Settings');

export const store = {
	get sections() {
		return data.sections;
	}
};

function validateEntry(section: SettingsEntry) {
	// TODO: Add validation
	Logger.info('hi');

	return true;
}

export function registerSettings(...entries: SettingsEntry[]) {
	const validated = entries.filter(entry => validateEntry(entry));

	Dispatcher.dispatch({ type: DispatchTypes.REGISTER_SETTINGS_ENTRIES, entries: validated });
};
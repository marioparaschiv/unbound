import type { SettingsEntry } from '@typings/api/settings';
import { createLogger } from '@structures/logger';
import { Dispatcher } from '@api/metro/common';
import { DISPATCH_TYPES } from '@constants';
import { data } from '@built-ins/settings';

export type * from '@typings/api/settings';

const Logger = createLogger('API', 'Settings');

export const store = {
	get sections() {
		return data.sections;
	}
};

function validateEntry(section: SettingsEntry) {
	Logger.info('hi');

	return true;
}

export function registerSettings(...entries: SettingsEntry[]) {
	const validated = entries.filter(entry => validateEntry(entry));

	Dispatcher.dispatch({ type: DISPATCH_TYPES.REGISTER_SETTINGS_ENTRIES, entries: validated });
};
import type { SettingsEntry } from '@unbound-app/settings';
import { storage } from '@unbound-app/api';

import { MESSAGE_NOTIFICATIONS } from '~/lib/constants';

type MessageLevel = SettingsEntry<'messages'>;

function levelOf(stored: number): MessageLevel | undefined {
	return (Object.keys(MESSAGE_NOTIFICATIONS) as MessageLevel[]).find(
		(level) => MESSAGE_NOTIFICATIONS[level] === stored,
	);
}

/**
 * @description Turns the message notification level 1.0.x stored as Discord's number into its choice, which the schema would otherwise reset. Does nothing once it is a choice.
 */
export function migrateSettings(): void {
	const bucket = storage.getBucket();
	const stored: unknown = bucket.get('messages', undefined);

	if (typeof stored !== 'number') return;

	const level = levelOf(stored);

	if (level) {
		bucket.set('messages', level);
	} else {
		bucket.remove('messages');
	}
}

export default migrateSettings;

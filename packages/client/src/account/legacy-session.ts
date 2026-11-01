import type { SettingsValue } from '@unbound-app/types';

import { ACCOUNT_STORE } from '~/account/api';
import { getBucket } from '~/storage/api';

// Sync owned the session before the account did.
const LEGACY_STORE = 'unbound::sync';

/**
 * @description Moves a session Sync saved into the account's Bucket, once, so nobody signed in to
 * Sync is signed out. A session already in the account's Bucket is kept.
 */
export function moveSyncSession(): void {
	const legacy = getBucket(LEGACY_STORE);
	const session = legacy.get<SettingsValue>('session', null);

	if (!session) {
		return;
	}

	const account = getBucket(ACCOUNT_STORE);

	if (account.get<SettingsValue | undefined>('session', undefined) === undefined) {
		account.set('session', session);
	}

	legacy.remove('session');
}

export default { moveSyncSession };

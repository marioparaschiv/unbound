import { metro, toasts } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import { defaultName, unseenSessions, type Session } from '~/lib/sessions';
import { rememberSessions, seenSessions } from '~/lib/store';

const MINUTE_MS = 60 * 1000;

type SessionsResponse = { body?: { user_sessions?: Session[] } };

async function checkSessions(): Promise<void> {
	try {
		const response = (await metro.common.REST.get({
			url: '/auth/sessions',
		})) as SessionsResponse;
		const sessions = response.body?.user_sessions ?? [];
		const known = seenSessions();
		const fresh = Object.keys(known).length ? unseenSessions(sessions, known) : [];

		for (const session of fresh) {
			toasts.show({
				title: messages.NEW_SESSION,
				content: format('NEW_SESSION_DETAILS', {
					name: defaultName(session),
					location: session.client_info.location,
				}),
			});
		}

		rememberSessions(sessions);
	} catch (error) {
		logger.error('Failed to check sessions for new devices:', error);
	}
}

/**
 * @description Checks the account's sessions every few minutes and announces each new one, when the setting is on.
 * The first check only records the sessions there already are.
 */
export function startBackgroundCheck(): void {
	if (!settings.backgroundCheck) return;

	void checkSessions();
	setInterval(() => void checkSessions(), settings.checkInterval * MINUTE_MS);
}

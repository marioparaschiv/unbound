import { Users } from '@unbound-app/api/metro/stores';
import { storage, toasts } from '@unbound-app/api';

import { GREET_ON_START, SETTINGS_BUCKET } from '~/constants';
import { platformName } from '~/greeting/platform';
import { greetingFor } from '~/greeting/message';

/**
 * @description Greets the signed-in user with a toast when the plugin starts, unless turned off.
 * Reads Discord's user store, which the SDK finds on first use.
 */
export function startGreeting() {
	if (!storage.getBucket(SETTINGS_BUCKET).get(GREET_ON_START, true)) return;

	toasts.show({
		content: greetingFor({
			username: Users.getCurrentUser()?.username,
			platform: platformName(),
		}),
	});
}

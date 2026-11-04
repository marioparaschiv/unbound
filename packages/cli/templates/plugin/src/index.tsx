import { settings } from '@unbound-app/settings';
import { toasts } from '@unbound-app/api';

import icon from '../assets/icon.png';

/** Greets the user, unless they turned the greeting off. */
export function start() {
	if (!settings.greetOnStart) return;

	toasts.success('GREETING_BODY', { name: addon.name }, { icon });
}

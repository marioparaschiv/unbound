import { messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';

import { PLUGIN_NAME } from '~/constants';

/**
 * @description Tells the user the system did not open the picture in picture window.
 */
export function showStartFailed(): void {
	toasts.show({
		title: PLUGIN_NAME,
		content: messages.START_FAILED,
	});
}

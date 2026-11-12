import { messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';

/**
 * @description Tells the user the system did not open the picture in picture window.
 */
export function showStartFailed(): void {
	toasts.show({
		title: addon.name,
		content: messages.START_FAILED,
	});
}

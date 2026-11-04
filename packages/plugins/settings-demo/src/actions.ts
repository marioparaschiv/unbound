import { settings } from '@unbound-app/settings';
import { toasts } from '@unbound-app/api';

/** @description Empties the word list and says so; the Clear cache button runs it. */
export function clearCache() {
	settings.words = [];
	toasts.show({ title: 'Settings Demo', content: 'clearCache ran: the word list is empty.' });
}

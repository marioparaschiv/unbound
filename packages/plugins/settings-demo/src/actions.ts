import { settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';

/** @description Empties the word list and says so; the Clear cache button runs it. */
export function clearCache() {
	settings.words = [];
	toasts.show({ title: messages.PLUGIN_NAME, content: messages.CACHE_CLEARED });
}

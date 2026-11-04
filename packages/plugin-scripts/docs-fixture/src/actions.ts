import { settings } from '@unbound-app/settings';

export function clearStarred() {
	settings.starred = [];
}

import { messages } from '@unbound-app/i18n';

import type { RawItem } from '~/raw/raw-items';

/**
 * @description Names a kind of record in the user's language, for the sheet's title and the copy notice.
 * @param type The kind of record the sheet shows.
 * @returns The translated name, such as `Message`.
 */
export function typeName(type: RawItem['type']): string {
	const names: Record<RawItem['type'], string> = {
		Message: messages.TYPE_MESSAGE,
		Profile: messages.TYPE_PROFILE,
		Channel: messages.TYPE_CHANNEL,
		Guild: messages.TYPE_GUILD,
		User: messages.TYPE_USER,
	};

	return names[type];
}

import { metro, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import { encodeThemeColors, parseHex } from '~/lib/three-y-three';

export function copyBioCode() {
	const primary = parseHex(settings.primary);
	const accent = parseHex(settings.accent);

	if (primary === undefined || accent === undefined) {
		toasts.show({ title: messages.COPY_CODE, content: messages.BAD_COLOR });

		return;
	}

	metro.common.Clipboard.setString(encodeThemeColors(primary, accent));
	toasts.show({ title: messages.COPY_CODE, content: messages.COPIED });
}

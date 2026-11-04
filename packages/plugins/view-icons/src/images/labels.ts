import { messages } from '@unbound-app/i18n';

import type { ImageKind } from '~/images/targets';

/**
 * @description Names the row that opens an image, in the user's language.
 * @param kind What the image shows.
 * @returns The row's label, such as `View Avatar`.
 */
export function viewLabel(kind: ImageKind): string {
	switch (kind) {
		case 'avatar':
			return messages.VIEW_AVATAR;
		case 'banner':
			return messages.VIEW_BANNER;
		case 'serverAvatar':
			return messages.VIEW_SERVER_AVATAR;
		case 'serverIcon':
			return messages.VIEW_SERVER_ICON;
		case 'serverBanner':
			return messages.VIEW_SERVER_BANNER;
		case 'groupIcon':
			return messages.VIEW_GROUP_ICON;
	}
}

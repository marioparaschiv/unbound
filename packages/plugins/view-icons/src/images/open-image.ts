import { format, messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';
import { Image } from 'react-native';

import { normalizeImageUrl } from '~/images/image-url';
import type { ImageTarget } from '~/images/targets';
import { Media } from '~/images/modules';

/**
 * @description Opens an image in Discord's media viewer at full resolution.
 * @param target The image to open.
 */
export function openImage(target: ImageTarget): void {
	const uri = normalizeImageUrl(target.url, 4096);

	function open(width: number, height: number) {
		try {
			Media.openMediaModal({
				initialIndex: 0,
				initialSources: [{ uri, sourceURI: uri, width, height }],
			});
		} catch {
			toasts.show({
				title: messages.VIEW_ICONS,
				content: format('UNABLE_TO_OPEN', { image: target.kind }),
			});
		}
	}

	function openAtDefaultSize() {
		open(target.size.width, target.size.height);
	}

	try {
		Image.getSize(uri, open, openAtDefaultSize);
	} catch {
		openAtDefaultSize();
	}
}

export default openImage;

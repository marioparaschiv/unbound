import { toasts } from '@unbound-app/api';
import { Image } from 'react-native';

import type { ImageTarget } from '~/targets';
import { normalizeImageUrl } from '~/image-url';
import { Media } from '~/modules';

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
			toasts.showToast({
				title: 'View Icons',
				content: `Unable to open ${target.label.toLowerCase()}.`,
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

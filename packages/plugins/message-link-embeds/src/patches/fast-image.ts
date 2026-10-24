import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { AnyProps } from '@unbound-app/api/metro';

import { animatedImageProps } from '~/animated-media';
import { embedComponent } from '~/embed-component';

/**
 * @description Plays animated images inside embeds, where Discord would otherwise wait for a tap.
 * @param FastImage The `FastImage` module, whose default export is a `memo`.
 * @returns A function that restores `FastImage`.
 */
export function patchFastImage(FastImage: AnyProps): () => void {
	const Memo = FastImage.default;

	if (!ensureModules('Message Link Embeds: animated images', { FastImage: Memo?.type })) {
		return () => {};
	}

	return embedComponent(Memo, 'type', animatedImageProps);
}

import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { AnyProps } from '@unbound-app/api/metro';

import { animatedLottieProps } from '~/animated-media';
import { embedComponent } from '~/embed-component';

/**
 * @description Loops Lottie stickers inside embeds.
 * @param NativeLottieView The `NativeLottieView` module.
 * @returns A function that restores `NativeLottieView`.
 */
export function patchNativeLottieView(NativeLottieView: AnyProps): () => void {
	const modules = { NativeLottieView: NativeLottieView.default };

	if (!ensureModules('Message Link Embeds: animated stickers', modules)) return () => {};

	return embedComponent(NativeLottieView, 'default', animatedLottieProps);
}

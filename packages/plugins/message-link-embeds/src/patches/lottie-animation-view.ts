import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { AnyProps } from '@unbound-app/api/metro';

import { animatedLottieProps } from '~/animated-media';
import { embedComponent } from '~/embed-component';

/**
 * @description Loops Lottie animations inside embeds.
 * @param LottieAnimationView The `LottieAnimationView` module.
 * @returns A function that restores `LottieAnimationView`.
 */
export function patchLottieAnimationView(LottieAnimationView: AnyProps): () => void {
	const modules = { LottieAnimationView: LottieAnimationView.default };

	if (!ensureModules('Message Link Embeds: animated Lottie', modules)) return () => {};

	return embedComponent(LottieAnimationView, 'default', animatedLottieProps);
}

import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';

import { FastImageSource, LottieAnimationViewSource, NativeLottieViewSource } from '~/modules';
import { patchLottieAnimationView } from '~/patches/lottie-animation-view';
import { patchNativeLottieView } from '~/patches/native-lottie-view';
import { patchFastImage } from '~/patches/fast-image';

/** Plays media inside embeds, each applied once Discord loads its component. */
export const mediaPatches = [
	() => whenLoaded(FastImageSource, patchFastImage),
	() => whenLoaded(LottieAnimationViewSource, patchLottieAnimationView),
	() => whenLoaded(NativeLottieViewSource, patchNativeLottieView),
];

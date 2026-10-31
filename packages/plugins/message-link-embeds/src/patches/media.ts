import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';

import { FastImageSource, LottieAnimationViewSource, NativeLottieViewSource } from '~/modules';
import { patchLottieAnimationView } from '~/patches/lottie-animation-view';
import { patchNativeLottieView } from '~/patches/native-lottie-view';
import { patchFastImage } from '~/patches/fast-image';

export const mediaPatches = [
	() => whenLoaded(FastImageSource, patchFastImage),
	() => whenLoaded(LottieAnimationViewSource, patchLottieAnimationView),
	() => whenLoaded(NativeLottieViewSource, patchNativeLottieView),
];

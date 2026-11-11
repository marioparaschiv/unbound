import type { ReactInsteadContext } from '@unbound-app/api/patcher';
import type { AnyProps } from '@unbound-app/api/metro';
import { metro, patcher } from '@unbound-app/api';
import { useContext } from 'react';

import { animatedImageProps, animatedLottieProps, type ImageProps } from '~/lib/animated-media';
import { EmbeddedMediaContext } from '~/components/embedded-media';
import { embedComponent } from '~/components/embed-component';

// Holder writes the patcher does not own, put back by `restoreLottieViews`.
const swaps: Array<() => void> = [];

/**
 * @description Plays animated images inside embeds, where Discord would otherwise wait for a tap. `FastImage` is a `memo`, so its render is patched.
 */
export function patchFastImage(): void {
	const FastImage = metro.findByFilePath('components_native/common/FastImage.tsx', {
		interop: false,
	});

	if (!FastImage) {
		logger.warn('Animated images skipped: Discord moved FastImage.');
		return;
	}

	patcher.react.instead(
		FastImage,
		'default',
		({ props, original }: ReactInsteadContext<ImageProps, undefined>) => {
			const embedded = useContext(EmbeddedMediaContext);

			return original(embedded ? animatedImageProps(props) : props);
		},
	);
}

// Swaps a Lottie component, which can be a class the patcher cannot render, for one that changes its props inside an embed.
function swapWhenLoaded(label: string, path: string) {
	metro.onModuleLoaded(
		metro.filters.byFilePath(path),
		(module: AnyProps) => {
			if (!module.default) {
				logger.warn(`${label} skipped: Discord moved its component.`);
				return;
			}

			swaps.push(embedComponent(module, 'default', animatedLottieProps));
		},
		{
			interop: false,
			onMissing: () => logger.warn(`${label} skipped: Discord moved ${path}.`),
		},
	);
}

/**
 * @description Loops Lottie animations and stickers inside embeds. The views can be class components, so they are swapped by file path when they load rather than patched.
 */
export function swapLottieViews(): void {
	swapWhenLoaded('Animated Lottie', 'components_native/common/LottieAnimationView.tsx');
	swapWhenLoaded('Animated stickers', 'modules/stickers/native/NativeLottieView.tsx');
}

/**
 * @description Puts back the Lottie views `swapLottieViews` replaced.
 */
export function restoreLottieViews(): void {
	for (const restore of swaps.splice(0)) restore();
}

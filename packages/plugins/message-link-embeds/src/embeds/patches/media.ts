import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';
import type { ReactInsteadContext } from '@unbound-app/api/patcher';
import type { AnyProps } from '@unbound-app/api/metro';
import { useContext } from 'react';

import { FastImage, LottieAnimationView, NativeLottieView } from '~/embeds/modules';
import { animatedImageProps, animatedLottieProps } from '~/embeds/animated-media';
import { EmbeddedMediaContext } from '~/embeds/components/embedded-media';
import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';

// Renders a media component with `embeddedProps` inside an embed, and as Discord has it everywhere else.
function playInEmbeds<P extends object>(media: AnyProps, embeddedProps: (props: P) => P) {
	patcher.react.instead(
		media,
		'default',
		({ props, original }: ReactInsteadContext<P, undefined>) => {
			const embedded = useContext(EmbeddedMediaContext);

			return original(embedded ? embeddedProps(props) : props);
		},
	);
	recordApplied(1);
}

/**
 * @description Plays animated images, Lottie animations and Lottie stickers inside embeds, where Discord would otherwise wait for a tap.
 * Patches the render of `FastImage` (a `memo`), `LottieAnimationView` and `NativeLottieView`, which can be class components, so each patch renders the original with new props.
 */
export function startMediaPatches(): void {
	if (ensureModules('Message Link Embeds: animated images', { FastImage })) {
		playInEmbeds(FastImage, animatedImageProps);
	}

	if (ensureModules('Message Link Embeds: animated Lottie', { LottieAnimationView })) {
		playInEmbeds(LottieAnimationView, animatedLottieProps);
	}

	if (ensureModules('Message Link Embeds: animated stickers', { NativeLottieView })) {
		playInEmbeds(NativeLottieView, animatedLottieProps);
	}
}

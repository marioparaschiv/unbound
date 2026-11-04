import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';
import type { ReactInsteadContext } from '@unbound-app/api/patcher';
import type { AnyProps } from '@unbound-app/api/metro';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { useContext } from 'react';

import { FastImage, LottieAnimationViewSource, NativeLottieViewSource } from '~/embeds/modules';
import { animatedImageProps, animatedLottieProps } from '~/embeds/animated-media';
import { EmbeddedMediaContext } from '~/embeds/components/embedded-media';
import { embedComponent } from '~/embeds/components/embed-component';

// Renders a `memo` image with `embeddedProps` inside an embed, and as Discord has it everywhere else.
function playImageInEmbeds<P extends object>(media: AnyProps, embeddedProps: (props: P) => P) {
	return patcher.react.instead(
		media,
		'default',
		({ props, original }: ReactInsteadContext<P, undefined>) => {
			const embedded = useContext(EmbeddedMediaContext);

			return original(embedded ? embeddedProps(props) : props);
		},
	);
}

// Swaps a Lottie component, which can be a class, for one that changes its props inside an embed.
function loopInEmbeds(label: string, source: string) {
	return whenLoaded<AnyProps>(
		source,
		(module) => {
			if (!ensureModules(label, { component: module.default })) return;

			return embedComponent(module, 'default', animatedLottieProps);
		},
		{ interop: false },
	);
}

/**
 * @description Plays animated images, Lottie animations and Lottie stickers inside embeds, where Discord would otherwise wait for a tap.
 * `FastImage` is a `memo` and is patched; the Lottie views can be class components, which the patcher cannot render, so they are swapped for a wrapper that renders them with new props.
 * @returns A function that puts the media components back.
 */
export function startMediaPatches(): () => void {
	const unpatches: Array<() => void> = [];

	if (ensureModules('Message Link Embeds: animated images', { FastImage })) {
		unpatches.push(playImageInEmbeds(FastImage, animatedImageProps));
	}

	unpatches.push(
		loopInEmbeds('Message Link Embeds: animated Lottie', LottieAnimationViewSource),
		loopInEmbeds('Message Link Embeds: animated stickers', NativeLottieViewSource),
	);

	return () => {
		for (const unpatch of unpatches.splice(0)) unpatch();
	};
}

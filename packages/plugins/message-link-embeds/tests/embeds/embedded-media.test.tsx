import { metro, render } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { Component, memo, type ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';

import { startMediaPatches } from '~/embeds/patches/media';
import { EmbeddedMediaContext } from '~/embeds/components/embedded-media';

type ImageProps = {
	source?: unknown;
	paused?: boolean;
	manualPlayback?: boolean;
	enableAnimation?: boolean;
};
type LottieProps = { source?: unknown; autoPlay?: boolean; loop?: boolean };

// Each component draws its props on a `View`, so a test reads what Discord's component was given.
const drawn = (props: object) => <View {...(props as ViewProps)} />;

const FastImage = { default: memo((props: ImageProps) => drawn(props)) };
// Discord's Lottie view is a class that reads `this.props`, so it cannot be rendered as a function.
class LottieClass extends Component<LottieProps> {
	override render() {
		return drawn(this.props);
	}
}
const LottieAnimationView = { default: LottieClass };
const NativeLottieView = { default: (props: LottieProps) => drawn(props) };

const animated = { uri: 'https://cdn.discordapp.com/emojis/123.webp?animated=true' };

beforeEach(() => {
	metro.register(FastImage, 'components_native/common/FastImage.tsx');
	metro.register(LottieAnimationView, 'components_native/common/LottieAnimationView.tsx');
	metro.register(NativeLottieView, 'modules/stickers/native/NativeLottieView.tsx');
});

function inEmbed(embedded: boolean, children: ReactNode) {
	return render(
		<EmbeddedMediaContext.Provider value={embedded}>{children}</EmbeddedMediaContext.Provider>,
	);
}

describe('media inside an embed', () => {
	test('animated images play without a tap', () => {
		startMediaPatches();

		const Image = FastImage.default;
		const view = inEmbed(true, <Image source={animated} paused manualPlayback />);

		expect(view.find('View').props).toMatchObject({
			enableAnimation: true,
			paused: false,
			manualPlayback: false,
		});
	});

	test('animated images wait for a tap everywhere else', () => {
		startMediaPatches();

		const Image = FastImage.default;
		const view = inEmbed(false, <Image source={animated} paused manualPlayback />);

		expect(view.find('View').props).toMatchObject({ paused: true, manualPlayback: true });
	});

	test('Lottie animations and stickers loop on their own', () => {
		startMediaPatches();

		const Animation = LottieAnimationView.default;
		const Sticker = NativeLottieView.default;
		const view = inEmbed(
			true,
			<>
				<Animation source='a' />
				<Sticker source='b' />
			</>,
		);

		expect(view.findAll('View').map((node) => node.props)).toMatchObject([
			{ autoPlay: true, loop: true },
			{ autoPlay: true, loop: true },
		]);
	});

	test('Lottie animations are left as Discord has them outside an embed', () => {
		startMediaPatches();

		const Animation = LottieAnimationView.default;

		expect(inEmbed(false, <Animation source='a' />).find('View').props).not.toHaveProperty(
			'autoPlay',
		);
	});

	test('a Lottie class component gets the new props', () => {
		startMediaPatches();

		const Animation = LottieAnimationView.default;

		expect(inEmbed(true, <Animation source='a' />).find('View').props).toMatchObject({
			source: 'a',
			autoPlay: true,
			loop: true,
		});
	});

	test('stopping puts every media component back', () => {
		const originals = [
			FastImage.default,
			LottieAnimationView.default,
			NativeLottieView.default,
		];
		const stop = startMediaPatches();

		expect(LottieAnimationView.default).not.toBe(originals[1]);

		stop();

		expect([FastImage.default, LottieAnimationView.default, NativeLottieView.default]).toEqual(
			originals,
		);
	});
});

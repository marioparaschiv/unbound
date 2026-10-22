import { describe, expect, test } from 'bun:test';
import {
	animatedImageProps,
	animatedLottieProps,
	enableAnimatedEmojiSources,
	installEmbeddedAnimationSupport,
	isAnimatedMediaSource,
} from '@message-link-embeds/animated-media';

type Props = Record<string, unknown>;
type TestContext = { Provider: symbol; value: boolean };

describe('embedded native media playback', () => {
	test('enables animated Discord emoji image playback', () => {
		const props = {
			paused: true,
			manualPlayback: true,
			source: {
				uri: 'https://cdn.discordapp.com/emojis/123.webp?size=96&animated=true',
			},
		};

		expect(isAnimatedMediaSource(props.source)).toBe(true);
		expect(animatedImageProps(props)).toEqual({
			...props,
			enableAnimation: true,
			manualPlayback: false,
			paused: false,
		});
		expect(animatedImageProps(props).source).toBe(props.source);
	});

	test('rewrites animated custom emoji sources to autoplayable GIF URLs', () => {
		const content = [
			{
				frozenSrc: 'https://cdn.discordapp.com/emojis/123.webp?size=96',
				src: 'https://cdn.discordapp.com/emojis/123.webp?size=96&animated=true',
				type: 'customEmoji',
			},
		];

		expect(enableAnimatedEmojiSources(content)).toBe(1);
		expect(content[0]?.src).toBe('https://cdn.discordapp.com/emojis/123.gif?size=96');
		expect(content[0]?.frozenSrc).toBe('https://cdn.discordapp.com/emojis/123.gif?size=96');
	});

	test('leaves static and non-emoji media sources unchanged', () => {
		const content = [
			{
				frozenSrc: 'https://cdn.discordapp.com/emojis/123.webp?size=96',
				src: 'https://cdn.discordapp.com/emojis/123.webp?size=96',
				type: 'customEmoji',
			},
			{
				src: 'https://cdn.discordapp.com/emojis/456.webp?size=96&animated=true',
				type: 'image',
			},
		];

		expect(enableAnimatedEmojiSources(content)).toBe(0);
		expect(content[0]?.src).toBe('https://cdn.discordapp.com/emojis/123.webp?size=96');
		expect(content[1]?.src).toBe(
			'https://cdn.discordapp.com/emojis/456.webp?size=96&animated=true',
		);
	});

	test('enables GIF and animated sticker image sources', () => {
		expect(isAnimatedMediaSource('https://media.example/image.gif?width=96')).toBe(true);
		expect(
			isAnimatedMediaSource('https://media.discordapp.net/stickers/456.png?size=160'),
		).toBe(true);
	});

	test('leaves static images unchanged', () => {
		const props = {
			source: 'https://cdn.discordapp.com/emojis/789.webp?size=96',
			paused: true,
		};

		expect(isAnimatedMediaSource(props.source)).toBe(false);
		expect(animatedImageProps(props)).toBe(props);
	});

	test('forces embedded Lottie sticker playback', () => {
		expect(
			animatedLottieProps({ autoPlay: false, loop: false, sourceURL: 'sticker.json' }),
		).toEqual({
			autoPlay: true,
			loop: true,
			sourceURL: 'sticker.json',
		});
	});

	test('patches loaded native media only inside the embedded tree and restores it', () => {
		const contexts: TestContext[] = [];
		const React = {
			createContext(value: boolean) {
				const context = { Provider: Symbol(), value };
				contexts.push(context);
				return context;
			},
			createElement(type: unknown, props: Props) {
				return { type, props };
			},
			useContext(context: TestContext) {
				return context.value;
			},
		} as Parameters<typeof installEmbeddedAnimationSupport>[0];
		const originalFastImage = (props: Props) => props;
		const fastImage = { type: originalFastImage };
		const fastImageModule = { default: fastImage };
		const originalLottie = (props: Props) => props;
		const lottieModule = { default: originalLottie };
		const originalStickerLottie = (props: Props) => props;
		const stickerLottieModule = { default: originalStickerLottie };
		const modules = new Map([
			['components_native/common/FastImage.tsx', fastImageModule],
			['components_native/common/LottieAnimationView.tsx', lottieModule],
		]);
		let moduleListener: ((module: unknown, id: string) => void) | undefined;
		const metro = {
			findByFilePath(path: string) {
				return modules.get(path);
			},
			addListener(listener: (module: unknown, id: string) => void) {
				moduleListener = listener;
				return () => true;
			},
		} as Parameters<typeof installEmbeddedAnimationSupport>[1];
		const support = installEmbeddedAnimationSupport(React, metro, (id) =>
			id === 'sticker-module' ? 'modules/stickers/native/NativeLottieView.tsx' : undefined,
		);
		contexts[0].value = true;
		modules.set('modules/stickers/native/NativeLottieView.tsx', stickerLottieModule);
		moduleListener?.(stickerLottieModule, 'sticker-module');
		const embeddedProps = {
			source: 'https://cdn.discordapp.com/emojis/123.webp?animated=true',
		};
		const fastImageOutput = fastImage.type(embeddedProps) as { type: unknown; props: Props };
		const embeddedLottie = lottieModule.default as (props: Props) => {
			type: unknown;
			props: Props;
		};
		const lottieOutput = embeddedLottie({ autoPlay: false, loop: false });
		const embeddedStickerLottie = stickerLottieModule.default as (props: Props) => {
			type: unknown;
			props: Props;
		};
		const stickerLottieOutput = embeddedStickerLottie({ autoPlay: false, loop: false });

		expect(fastImageOutput.type).toBe(originalFastImage);
		expect(fastImageOutput.props).toEqual({
			...embeddedProps,
			enableAnimation: true,
			manualPlayback: false,
			paused: false,
		});
		expect(lottieOutput.props).toEqual({ autoPlay: true, loop: true });
		expect(stickerLottieOutput.props).toEqual({ autoPlay: true, loop: true });

		contexts[0].value = false;
		const standardProps = { source: 'https://cdn.discordapp.com/emojis/123.webp' };
		const standardOutput = fastImage.type(standardProps) as { props: Props };

		expect(standardOutput.props).toBe(standardProps);

		support.dispose();

		expect(fastImage.type).toBe(originalFastImage);
		expect(lottieModule.default).toBe(originalLottie);
		expect(stickerLottieModule.default).toBe(originalStickerLottie);
	});
});

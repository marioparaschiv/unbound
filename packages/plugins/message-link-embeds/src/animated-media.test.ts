import { describe, expect, test } from 'bun:test';

import {
	animatedImageProps,
	animatedLottieProps,
	enableAnimatedEmojiSources,
	isAnimatedMediaSource,
} from '~/animated-media';

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
		const props = { autoPlay: false, loop: false, sourceURL: 'sticker.json' };

		expect(animatedLottieProps(props)).toEqual({
			autoPlay: true,
			loop: true,
			sourceURL: 'sticker.json',
		});
	});
});

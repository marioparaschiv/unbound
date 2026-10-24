type ImageProps = {
	source?: unknown;
	enableAnimation?: boolean;
	manualPlayback?: boolean;
	paused?: boolean;
};

type LottieProps = {
	autoPlay?: boolean;
	loop?: boolean;
};

type ContentNode = {
	type?: unknown;
	src?: unknown;
	frozenSrc?: unknown;
};

function sourceUri(source: unknown): string | undefined {
	if (typeof source === 'string') return source;
	if (!source || typeof source !== 'object') return;

	const { uri } = source as { uri?: unknown };

	return typeof uri === 'string' ? uri : undefined;
}

// React Native's `URL` throws on unparsable input and on members it does not implement.
function animatedGifSource(source: string): string | undefined {
	try {
		const url = new URL(source);

		if (
			url.hostname !== 'cdn.discordapp.com' ||
			!/^\/emojis\/\d+\.webp$/.test(url.pathname) ||
			url.searchParams.get('animated') !== 'true'
		) {
			return;
		}

		url.pathname = url.pathname.replace(/\.webp$/, '.gif');
		url.searchParams.delete('animated');

		return url.toString();
	} catch {
		return;
	}
}

/**
 * @description Tells whether an image source is a GIF, an animated emoji, or an animated sticker.
 * @param source An image `source` prop: a URI string, `{ uri }`, or an array of them.
 * @returns `true` when the source animates.
 */
export function isAnimatedMediaSource(source: unknown): boolean {
	if (Array.isArray(source)) return source.some(isAnimatedMediaSource);

	const uri = sourceUri(source);

	if (!uri) return false;
	if (/^data:image\/gif/i.test(uri) || /\.gif(?:$|[?#])/i.test(uri)) return true;

	try {
		const url = new URL(uri);

		return (
			url.searchParams.get('animated') === 'true' ||
			/^\/stickers\/\d+\.(?:png|webp)$/.test(url.pathname)
		);
	} catch {
		return /[?&]animated=true(?:&|$)/i.test(uri);
	}
}

/**
 * @description Makes an animated image play on its own.
 * @param props The image's props.
 * @returns New props with playback enabled, or the same props when the source does not animate.
 */
export function animatedImageProps(props: ImageProps): ImageProps {
	if (!isAnimatedMediaSource(props.source)) return props;

	return { ...props, enableAnimation: true, manualPlayback: false, paused: false };
}

/**
 * @description Makes a Lottie animation play on a loop.
 * @param props The animation's props.
 * @returns New props with autoplay and looping on.
 */
export function animatedLottieProps<T extends LottieProps>(props: T): T {
	return { ...props, autoPlay: true, loop: true };
}

/**
 * @description Points every animated custom emoji in parsed message content at its GIF, which plays without interaction.
 * @param content The parsed content tree, changed in place.
 * @returns How many emoji were changed.
 */
export function enableAnimatedEmojiSources(content: unknown): number {
	let updated = 0;
	const visited = new WeakSet<object>();

	function visit(value: unknown): void {
		if (!value || typeof value !== 'object' || visited.has(value)) return;

		visited.add(value);

		if (Array.isArray(value)) {
			for (const child of value) visit(child);

			return;
		}

		const node = value as ContentNode;

		if (node.type === 'customEmoji' && typeof node.src === 'string') {
			const source = animatedGifSource(node.src);

			if (source) {
				node.src = source;

				if (typeof node.frozenSrc === 'string') node.frozenSrc = source;

				updated++;
			}
		}

		for (const child of Object.values(node)) visit(child);
	}

	visit(content);

	return updated;
}

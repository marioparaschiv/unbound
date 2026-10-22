import type { Context, ReactNode } from 'react';

type AnyRecord = Record<string, unknown>;
type Component = ((props: AnyRecord) => ReactNode) & {
	defaultProps?: AnyRecord;
	displayName?: string;
};
type ReactRuntime = Pick<typeof import('react'), 'createContext' | 'createElement' | 'useContext'>;
type ReactContext = Context<boolean>;
type MetroRuntime = typeof import('@unbound-app/api/metro');
type EmbeddedAnimationSupport = {
	context: ReactContext;
	dispose: () => void;
};

const FAST_IMAGE_PATH = 'components_native/common/FastImage.tsx';
const LOTTIE_VIEW_PATH = 'components_native/common/LottieAnimationView.tsx';
const STICKER_LOTTIE_PATH = 'modules/stickers/native/NativeLottieView.tsx';
const ANIMATED_COMPONENT_PATHS = new Set([FAST_IMAGE_PATH, LOTTIE_VIEW_PATH, STICKER_LOTTIE_PATH]);

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

export function animatedImageProps(props: AnyRecord): AnyRecord {
	if (!isAnimatedMediaSource(props.source)) return props;

	return {
		...props,
		enableAnimation: true,
		manualPlayback: false,
		paused: false,
	};
}

export function animatedLottieProps(props: AnyRecord): AnyRecord {
	return {
		...props,
		autoPlay: true,
		loop: true,
	};
}

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

		const entry = value as AnyRecord;
		if (entry.type === 'customEmoji' && typeof entry.src === 'string') {
			const source = animatedGifSource(entry.src);
			if (source) {
				entry.src = source;
				if (typeof entry.frozenSrc === 'string') entry.frozenSrc = source;
				updated++;
			}
		}

		for (const child of Object.values(entry)) visit(child);
	}

	visit(content);
	return updated;
}

export function installEmbeddedAnimationSupport(
	React: ReactRuntime,
	metro: MetroRuntime,
	modulePath: (id: number | string) => string | undefined,
): EmbeddedAnimationSupport {
	const context = React.createContext(false);
	const restores: Array<() => void> = [];
	const patchedFastImages = new WeakSet<object>();
	const patchedLottieModules = new WeakSet<object>();
	let disposed = false;

	function patchFastImage(): void {
		const fastImageModule = metro.findByFilePath(FAST_IMAGE_PATH, { interop: false });
		const fastImage = fastImageModule?.default as { type?: Component } | undefined;
		const originalFastImage = fastImage?.type;
		if (!fastImage || !originalFastImage || patchedFastImages.has(fastImage)) return;

		const wrappedFastImage: Component = (props) => {
			const embedded = React.useContext(context) === true;
			const nextProps = embedded ? animatedImageProps(props) : props;
			return React.createElement(originalFastImage, nextProps);
		};
		fastImage.type = wrappedFastImage;
		patchedFastImages.add(fastImage);
		restores.push(() => {
			if (fastImage.type === wrappedFastImage) fastImage.type = originalFastImage;
		});
	}

	function patchLottie(path: string): void {
		const lottieModule = metro.findByFilePath(path, { interop: false });
		if (!lottieModule || patchedLottieModules.has(lottieModule)) return;

		const originalLottie = lottieModule.default as Component | undefined;
		if (!originalLottie) return;

		const wrappedLottie: Component = (props) => {
			const embedded = React.useContext(context) === true;
			const nextProps = embedded ? animatedLottieProps(props) : props;
			return React.createElement(originalLottie, nextProps);
		};
		wrappedLottie.defaultProps = originalLottie.defaultProps;
		wrappedLottie.displayName = originalLottie.displayName ?? originalLottie.name;
		lottieModule.default = wrappedLottie;
		patchedLottieModules.add(lottieModule);
		restores.push(() => {
			if (lottieModule.default === wrappedLottie) lottieModule.default = originalLottie;
		});
	}

	function patchLoadedComponents(path?: string): void {
		if (!path || path === FAST_IMAGE_PATH) patchFastImage();
		if (!path || path === LOTTIE_VIEW_PATH) patchLottie(LOTTIE_VIEW_PATH);
		if (!path || path === STICKER_LOTTIE_PATH) patchLottie(STICKER_LOTTIE_PATH);
	}

	patchLoadedComponents();
	const removeListener = metro.addListener?.((_module, id) => {
		const path = modulePath(id);
		if (ANIMATED_COMPONENT_PATHS.has(path ?? '')) patchLoadedComponents(path);
	});

	return {
		context,
		dispose() {
			if (disposed) return;
			disposed = true;
			removeListener?.();
			for (const restore of restores.reverse()) restore();
		},
	};
}

function sourceUri(source: unknown): string | undefined {
	if (typeof source === 'string') return source;
	if (!source || typeof source !== 'object') return;
	const uri = (source as AnyRecord).uri;
	return typeof uri === 'string' ? uri : undefined;
}

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

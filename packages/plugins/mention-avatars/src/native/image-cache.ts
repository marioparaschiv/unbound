import type { NativeObjCBridge } from '@unbound-app/api/native';

import { roleSymbol, roundedAvatar, tintRoleSymbol } from '~/native/images';
import type { Bridge, Handle } from '~/native/bridge';
import type { Mention, MentionType } from '~/mentions';

type ImageBytes = ArrayBuffer | Uint8Array;

type FileReader = Pick<NativeObjCBridge, 'getClass' | 'invokeAsync'>;

type CacheEntry = {
	image: Handle | null;
	pending?: Promise<Handle | null>;
	retryAt?: number;
};

export type ImageCache = ReturnType<typeof createImageCache>;

/**
 * @description Reads the file path of an image bundled with Discord.
 * @param url The image URL.
 * @returns The decoded path for a `file:///` URL, otherwise `undefined`.
 */
export function bundledFilePath(url: string): string | undefined {
	if (url.startsWith('file:///')) return decodeURIComponent(url.slice('file://'.length));
}

/**
 * @description Reads an image's bytes from Discord's app bundle (`file:///`) or the CDN (`https://`).
 * @param url The image URL.
 * @param objc The plugin's Objective-C bridge, used to read bundled files.
 * @returns The bytes, or `null` for an unsupported URL or a failed read.
 */
export async function loadImageBytes(url: string, objc: FileReader): Promise<ImageBytes | null> {
	const path = bundledFilePath(url);

	if (path) {
		const NSData = objc.getClass('NSData');

		if (!NSData) return null;

		const bytes = await objc.invokeAsync(NSData, 'dataWithContentsOfFile:', [path]);

		return bytes instanceof Uint8Array ? bytes : null;
	}

	if (!url.startsWith('https://')) return null;

	const response = await fetch(url);

	return response.ok ? response.arrayBuffer() : null;
}

/**
 * @description Creates the cache of mention images, loading avatars and role icons in the background.
 * @param bridge The plugin's native bridge.
 * @param onLoad Called after an image finishes loading or fails, so visible cells can redraw.
 * @returns The cache.
 */
export function createImageCache(bridge: Bridge, onLoad: () => void) {
	const images = new Map<string, CacheEntry>();
	const roleImages = new Map<number, Handle>();
	let revision = 0;
	let disposed = false;

	function roleImage(roleColor?: number): Handle | null {
		const cached = roleColor ? roleImages.get(roleColor) : undefined;

		if (cached) return cached;

		const symbol = roleSymbol(bridge);

		if (!symbol) return null;

		const image = tintRoleSymbol(bridge, symbol, roleColor);

		if (roleColor && image !== symbol) {
			if (roleImages.size >= 64) roleImages.delete(roleImages.keys().next().value!);

			roleImages.set(roleColor, image);
		}

		return image;
	}

	async function download(url: string, type: MentionType): Promise<Handle | null> {
		const bytes = await loadImageBytes(url, bridge.objc);

		if (!bytes) return null;

		const UIImage = bridge.objc.getClass('UIImage');
		const image = UIImage && bridge.handle(UIImage, 'imageWithData:', bridge.objc.data(bytes));

		if (!image) return null;

		return type === 'user' ? roundedAvatar(bridge, image) : image;
	}

	function load(url: string, type: MentionType) {
		const pending = download(url, type).catch(() => null);

		images.set(url, { image: null, pending });

		void pending.then((image) => {
			if (disposed) return;

			images.set(url, image ? { image } : { image: null, retryAt: Date.now() + 5_000 });
			revision++;
			onLoad();
		});
	}

	// Returns `null` while an image loads; `onLoad` reports when to ask again.
	function imageFor({ avatarURL, roleColor, type }: Mention): Handle | null {
		if (!avatarURL) return type === 'role' ? roleImage(roleColor) : null;

		const entry = images.get(avatarURL);

		if (entry?.image) return entry.image;

		if (!entry?.pending && !((entry?.retryAt ?? 0) > Date.now())) load(avatarURL, type);

		return null;
	}

	return {
		imageFor,
		revision: () => revision,
		dispose() {
			disposed = true;
			images.clear();
			roleImages.clear();
		},
	};
}

export default { bundledFilePath, loadImageBytes, createImageCache };

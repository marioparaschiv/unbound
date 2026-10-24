import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';

import { MediaManagerFilters, MediaTypes, MediaTypesFile, Patcher } from '~/modules';
import { getPreferredGifUrl, isGifSource } from '~/gif-url';
import type { MediaManager } from '~/modules';
import { resolveKlipyGifUrl } from '~/klipy';

type DownloadMethod = 'downloadMediaAsset' | 'downloadMediaAssetWithContentType';

// Discord's `MediaType.GIF` from wherever the enum is exported, or `1` when none is found.
function getGifType(manager: MediaManager): number {
	return (
		manager.MediaType?.GIF ??
		MediaTypes.MediaType?.GIF ??
		MediaTypesFile.MediaType?.GIF ??
		MediaTypesFile.default?.MediaType?.GIF ??
		1
	);
}

function patchDownload(manager: MediaManager, method: DownloadMethod) {
	// Both methods take `(source, mediaType, contentType?)`.
	function asGif(args: unknown[], gifUrl: string): unknown[] {
		const rewritten = [...args];

		rewritten[0] = gifUrl;
		rewritten[1] = getGifType(manager);

		if (method === 'downloadMediaAssetWithContentType') rewritten[2] = 'image/gif';

		return rewritten;
	}

	return Patcher.instead(manager, method, ({ args, original, this: self }) => {
		const [source, , contentType] = args;
		const gifUrl = getPreferredGifUrl(source);

		if (gifUrl) return original.apply(self, asGif(args, gifUrl));

		if (!isGifSource(source, contentType)) return original.apply(self, args);

		return resolveKlipyGifUrl(source).then((resolved) =>
			original.apply(self, resolved ? asGif(args, resolved) : args),
		);
	});
}

function patchManager(manager: MediaManager): () => void {
	const unpatches: (() => void)[] = [];

	// Resolving Klipy GIFs while media is shown keeps the later download instant.
	for (const method of [
		'extractMediaSourcesFromMessage',
		'extractMediaSourcesFromEmbed',
		'extractMediaFromEmbed',
		'extractMediaFromAttachment',
		'getEmbedMedia',
	] as const) {
		if (typeof manager[method] !== 'function') {
			continue;
		}

		unpatches.push(
			Patcher.after(manager, method, ({ args, result }) => {
				void resolveKlipyGifUrl(args[0]);
				void resolveKlipyGifUrl(result);
			}),
		);
	}

	if (typeof manager.isGIFSource === 'function') {
		unpatches.push(
			Patcher.after(manager, 'isGIFSource', ({ args }) => {
				if (isGifSource(args[0], args[1])) return true;
			}),
		);
	}

	for (const method of ['downloadMediaAsset', 'downloadMediaAssetWithContentType'] as const) {
		if (typeof manager[method] === 'function') {
			unpatches.push(patchDownload(manager, method));
		}
	}

	return () => {
		for (const unpatch of unpatches) unpatch();
	};
}

/**
 * @description Makes Discord treat GIF provider media as GIFs and save them as GIF files instead of videos, once its media manager loads.
 * @returns A function that stops waiting for the media manager, or removes every patch.
 */
export function patchMediaManager(): () => void {
	return whenLoaded(MediaManagerFilters, patchManager);
}

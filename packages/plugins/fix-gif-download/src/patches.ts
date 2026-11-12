import { metro, patcher } from '@unbound-app/api';

import { isRecord, type MediaRecord } from '~/lib/media-record';
import { getPreferredGifUrl, isGifSource } from '~/lib/gif-url';
import { resolveKlipyGifUrl } from '~/lib/klipy';

type MediaMethod = (...args: unknown[]) => unknown;

type MediaTypesModule = {
	MediaType?: { GIF?: number };
	default?: MediaTypesModule;
};

// Typed as required so the patcher accepts them, though any but `downloadMediaAsset` may be missing; patches check first.
type MediaManager = MediaTypesModule & {
	downloadMediaAsset: MediaMethod;
	downloadMediaAssetWithContentType: MediaMethod;
	isGIFSource: MediaMethod;
	extractMediaSourcesFromMessage: MediaMethod;
	extractMediaSourcesFromEmbed: MediaMethod;
	extractMediaFromEmbed: MediaMethod;
	extractMediaFromAttachment: MediaMethod;
	getEmbedMedia: MediaMethod;
};

type MediaShareActions = {
	useMediaShareActions: (...args: unknown[]) => unknown;
};

type DownloadMethod = 'downloadMediaAsset' | 'downloadMediaAssetWithContentType';

// The modules that may export Discord's `MediaType` enum, besides the media manager.
type MediaTypeModules = {
	MediaTypes: MediaTypesModule | undefined;
	MediaTypesFile: MediaTypesModule | undefined;
};

// Discord's `MediaType.GIF` from wherever the enum is exported, or `1` when none is found.
function getGifType(
	manager: MediaManager,
	{ MediaTypes, MediaTypesFile }: MediaTypeModules,
): number {
	return (
		manager.MediaType?.GIF ??
		MediaTypes?.MediaType?.GIF ??
		MediaTypesFile?.MediaType?.GIF ??
		MediaTypesFile?.default?.MediaType?.GIF ??
		1
	);
}

function patchDownload(manager: MediaManager, method: DownloadMethod, types: MediaTypeModules) {
	// Both methods take `(source, mediaType, contentType?)`.
	function asGif(args: unknown[], gifUrl: string): unknown[] {
		const rewritten = [...args];

		rewritten[0] = gifUrl;
		rewritten[1] = getGifType(manager, types);

		if (method === 'downloadMediaAssetWithContentType') rewritten[2] = 'image/gif';

		return rewritten;
	}

	patcher.instead(manager, method, ({ args, original, this: self }) => {
		const [source, , contentType] = args;
		const gifUrl = getPreferredGifUrl(source);

		if (gifUrl) return original.apply(self, asGif(args, gifUrl));

		if (!isGifSource(source, contentType)) return original.apply(self, args);

		return resolveKlipyGifUrl(source).then((resolved) =>
			original.apply(self, resolved ? asGif(args, resolved) : args),
		);
	});
}

function patchManager(manager: MediaManager, types: MediaTypeModules) {
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

		patcher.after(manager, method, ({ args, result }) => {
			void resolveKlipyGifUrl(args[0]);
			void resolveKlipyGifUrl(result);
		});
	}

	if (typeof manager.isGIFSource === 'function') {
		patcher.after(manager, 'isGIFSource', ({ args }) => {
			if (isGifSource(args[0], args[1])) return true;
		});
	}

	for (const method of ['downloadMediaAsset', 'downloadMediaAssetWithContentType'] as const) {
		if (typeof manager[method] === 'function') {
			patchDownload(manager, method, types);
		}
	}
}

/**
 * @description Makes Discord treat GIF provider media as GIFs and save them as GIF files instead of videos, once its media manager loads.
 * Patches the media manager's download and media-extraction methods, and `isGIFSource`, preferring the module with both download methods.
 */
export function patchMediaManager(): void {
	const types: MediaTypeModules = {
		MediaTypes: metro.findByProps('GIF_RE_IOS', 'MediaType'),
		MediaTypesFile: metro.findByFilePath('modules/media/MediaTypes.tsx', { interop: false }),
	};
	let done = false;

	for (const filter of [
		metro.filters.byProps('downloadMediaAsset', 'downloadMediaAssetWithContentType'),
		metro.filters.byProps('downloadMediaAsset'),
	]) {
		if (done) break;

		metro.onModuleLoaded(filter, (manager: MediaManager) => {
			if (done) return;

			done = true;
			patchManager(manager, types);
		});
	}
}

function pointAtGif(source: MediaRecord, gifUrl: string) {
	source.uri = gifUrl;
	source.sourceURI = gifUrl;
	source.contentType = 'image/gif';
	delete source.videoURI;
	delete source.isGIFV;
}

function patchShareActions(module: MediaShareActions) {
	patcher.before(module, 'useMediaShareActions', ({ args }) => {
		const [options] = args;

		if (!isRecord(options) || !isRecord(options.source)) return;

		const { source } = options;
		const gifUrl = getPreferredGifUrl(source);

		if (gifUrl) {
			pointAtGif(source, gifUrl);

			return;
		}

		void resolveKlipyGifUrl(source).then((resolved) => {
			if (resolved) pointAtGif(source, resolved);
		});
	});
}

/**
 * @description Points the media viewer's share and save actions at the GIF instead of its video rendition, patching each copy as Discord loads it.
 * Patches `useMediaShareActions` in every copy of the media viewer's share actions module: the loaded ones now, the rest as Discord loads them.
 */
export function patchMediaShareActions(): void {
	const byMediaShareActions = metro.filters.byProps('useMediaShareActions');
	const seen = new Set<MediaShareActions>();

	// Mirrors `find`'s matching, which returns a module's `default` export when only that matches.
	function asMediaShareActions(exports: MediaShareActions & { default?: MediaShareActions }) {
		if (byMediaShareActions(exports, 0)) return exports;
		if (exports.default && byMediaShareActions(exports.default, 0)) return exports.default;
	}

	function load(module: MediaShareActions | undefined) {
		if (!module || seen.has(module)) return;

		seen.add(module);
		patchShareActions(module);
	}

	const loaded: MediaShareActions[] = metro.find(byMediaShareActions, {
		all: true,
		initialize: false,
	});

	for (const module of loaded) load(module);

	metro.onModuleLoad((exports) => load(asMediaShareActions(exports)));
}

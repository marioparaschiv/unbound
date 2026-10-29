import { metro, patcher } from '@unbound-app/api';

type MediaMethod = (...args: unknown[]) => unknown;

type MediaTypeEnum = {
	GIF?: number;
};

type MediaTypesModule = {
	MediaType?: MediaTypeEnum;
	default?: MediaTypesModule;
};

// Typed as required so the patcher accepts them, though any but `downloadMediaAsset` may be missing; patches check first.
export type MediaManager = MediaTypesModule & {
	downloadMediaAsset: MediaMethod;
	downloadMediaAssetWithContentType: MediaMethod;
	isGIFSource: MediaMethod;
	extractMediaSourcesFromMessage: MediaMethod;
	extractMediaSourcesFromEmbed: MediaMethod;
	extractMediaFromEmbed: MediaMethod;
	extractMediaFromAttachment: MediaMethod;
	getEmbedMedia: MediaMethod;
};

export type MediaShareActions = {
	useMediaShareActions: MediaMethod;
};

export const MediaTypes: MediaTypesModule = metro.findByProps('GIF_RE_IOS', 'MediaType', {
	lazy: true,
});
export const MediaTypesFile: MediaTypesModule = metro.findByFilePath(
	'modules/media/MediaTypes.tsx',
	{ lazy: true, interop: false },
);

export const Patcher = patcher.createPatcher('unbound.fix-gif-download');

// Discord's media manager, which saves media to the photo library, preferring the module with both download methods.
export const MediaManagerFilters = [
	metro.filters.byProps('downloadMediaAsset', 'downloadMediaAssetWithContentType'),
	metro.filters.byProps('downloadMediaAsset'),
];

const byMediaShareActions = metro.filters.byProps('useMediaShareActions');

// Mirrors `find`'s matching, which returns a module's `default` export when only that matches.
function asMediaShareActions(exports: MediaShareActions & { default?: MediaShareActions }) {
	if (byMediaShareActions(exports, 0)) return exports;
	if (exports.default && byMediaShareActions(exports.default, 0)) return exports.default;
}

/**
 * @description Passes every copy of the media viewer's share actions to `onLoad`: the loaded ones now, the rest as Discord loads them.
 * @param onLoad Receives each module exporting `useMediaShareActions`, once.
 * @returns A function that stops waiting for more copies.
 */
export function onMediaShareActions(onLoad: (module: MediaShareActions) => void): () => void {
	const seen = new Set<MediaShareActions>();

	function load(module: MediaShareActions | undefined) {
		if (!module || seen.has(module)) return;

		seen.add(module);
		onLoad(module);
	}

	const loaded: MediaShareActions[] = metro.find(byMediaShareActions, {
		all: true,
		initialize: false,
	});

	for (const module of loaded) load(module);

	const stop = metro.addListener((exports) => load(asMediaShareActions(exports)));

	return () => void stop();
}

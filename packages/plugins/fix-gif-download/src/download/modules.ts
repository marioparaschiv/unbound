import { metro } from '@unbound-app/api';

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

export const MediaTypes: MediaTypesModule = metro.findByProps('GIF_RE_IOS', 'MediaType');
export const MediaTypesFile: MediaTypesModule = metro.findByFilePath(
	'modules/media/MediaTypes.tsx',
	{ interop: false },
);

// Discord's media manager, which saves media to the photo library, preferring the module with both download methods.
export const MediaManagerFilters = [
	metro.filters.byProps('downloadMediaAsset', 'downloadMediaAssetWithContentType'),
	metro.filters.byProps('downloadMediaAsset'),
];

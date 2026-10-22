import { metro, patcher } from '@unbound-app/api';

import { getPreferredGifUrl, isGifSource, resolveKlipyGifUrl } from '@fix-gif-download/media';

const PATCHER = patcher.createPatcher('unbound.fix-gif-download');

type MediaManager = {
	MediaType?: Record<string, unknown>;
	isGIFSource?: (source: unknown) => unknown;
	extractMediaSourcesFromMessage?: (...args: unknown[]) => unknown;
	extractMediaSourcesFromEmbed?: (...args: unknown[]) => unknown;
	extractMediaFromEmbed?: (...args: unknown[]) => unknown;
	extractMediaFromAttachment?: (...args: unknown[]) => unknown;
	getEmbedMedia?: (...args: unknown[]) => unknown;
	downloadMediaAsset?: (...args: unknown[]) => unknown;
	downloadMediaAssetWithContentType?: (...args: unknown[]) => unknown;
};

type MediaShareActions = {
	useMediaShareActions?: (...args: unknown[]) => unknown;
};

type MediaTypes = Record<string, unknown>;

let mediaManager: MediaManager | null = null;
let unpatches: Array<() => void> = [];
let retryTimer: ReturnType<typeof setInterval> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object';
}

function getMediaManager(): MediaManager | null {
	const manager = metro.findByProps(
		'downloadMediaAsset',
		'downloadMediaAssetWithContentType',
	) as MediaManager | null;
	if (manager?.downloadMediaAsset || manager?.downloadMediaAssetWithContentType) return manager;
	return metro.findByProps('downloadMediaAsset') as MediaManager | null;
}

function getMediaTypes(): MediaTypes | null {
	const managerTypes = mediaManager?.MediaType;
	if (managerTypes) return managerTypes;

	const props = metro.findByProps('GIF_RE_IOS', 'MediaType') as Record<string, unknown> | null;
	if (isRecord(props?.MediaType)) return props.MediaType;

	const module = metro.findByFilePath('modules/media/MediaTypes.tsx', {
		interop: false,
	}) as Record<string, unknown> | null;
	if (isRecord(module?.MediaType)) return module.MediaType;
	if (isRecord(module?.default) && isRecord(module.default.MediaType))
		return module.default.MediaType;

	return null;
}

function getGifMediaType(): unknown {
	return getMediaTypes()?.GIF ?? 1;
}

function patchDownloadMethod(
	manager: MediaManager,
	method: 'downloadMediaAsset' | 'downloadMediaAssetWithContentType',
): void {
	if (typeof manager[method] !== 'function') return;

	const unpatch = PATCHER.instead(manager, method, ({ args, original, this: self }) => {
		const [source, , contentType] = args;
		const gifType = getGifMediaType();
		const directGifUrl = getPreferredGifUrl(source);
		if (directGifUrl) {
			const rewrittenArgs = [...args];
			rewrittenArgs[0] = directGifUrl;
			rewrittenArgs[1] = gifType;
			if (method === 'downloadMediaAssetWithContentType') rewrittenArgs[2] = 'image/gif';
			return original.apply(self, rewrittenArgs);
		}
		if (!isGifSource(source, contentType)) return original.apply(self, args);
		return resolveKlipyGifUrl(source).then((gifUrl) => {
			if (!gifUrl) return original.apply(self, args);
			const rewrittenArgs = [...args];
			rewrittenArgs[0] = gifUrl;
			rewrittenArgs[1] = gifType;
			if (method === 'downloadMediaAssetWithContentType') rewrittenArgs[2] = 'image/gif';
			return original.apply(self, rewrittenArgs);
		});
	});
	unpatches.push(unpatch);
}

function patchGifDetection(manager: MediaManager): void {
	if (typeof manager.isGIFSource !== 'function') return;

	const unpatch = PATCHER.after(manager, 'isGIFSource', (ctx) => {
		if (isGifSource(ctx.args[0], ctx.args[1])) return true;
		return ctx.result;
	});
	unpatches.push(unpatch);
}

function patchMediaShareActions(): void {
	const found = metro.findByProps('useMediaShareActions', { all: true }) as
		| MediaShareActions[]
		| MediaShareActions
		| null;
	const modules = Array.isArray(found) ? found : found ? [found] : [];
	const seen = new Set<MediaShareActions>();
	for (const module of modules) {
		if (seen.has(module) || typeof module.useMediaShareActions !== 'function') continue;
		seen.add(module);
		const unpatch = PATCHER.before(module, 'useMediaShareActions', (ctx) => {
			const options = ctx.args[0];
			if (!isRecord(options) || !isRecord(options.source)) return;
			const source = options.source;
			const gifUrl = getPreferredGifUrl(source);
			if (gifUrl) {
				applyGifSource(source, gifUrl);
				return;
			}
			void resolveKlipyGifUrl(source).then((resolved) => {
				if (resolved) applyGifSource(source, resolved);
			});
		});
		unpatches.push(unpatch);
	}
}

function applyGifSource(source: Record<string, unknown>, gifUrl: string): void {
	source.uri = gifUrl;
	source.sourceURI = gifUrl;
	source.contentType = 'image/gif';
	delete source.videoURI;
	delete source.isGIFV;
}

function patchMediaExtraction(manager: MediaManager): void {
	for (const method of [
		'extractMediaSourcesFromMessage',
		'extractMediaSourcesFromEmbed',
		'extractMediaFromEmbed',
		'extractMediaFromAttachment',
		'getEmbedMedia',
	] as const) {
		if (typeof manager[method] !== 'function') continue;
		const unpatch = PATCHER.after(manager, method, ({ args, result }) => {
			void resolveKlipyGifUrl(args[0]);
			void resolveKlipyGifUrl(result);
			return result;
		});
		unpatches.push(unpatch);
	}
}

function patchMediaManager(): boolean {
	if (mediaManager) return true;
	const manager = getMediaManager();
	if (!manager) return false;

	mediaManager = manager;
	patchMediaShareActions();
	patchMediaExtraction(manager);
	patchGifDetection(manager);
	patchDownloadMethod(manager, 'downloadMediaAsset');
	patchDownloadMethod(manager, 'downloadMediaAssetWithContentType');
	return unpatches.length > 0;
}

function stopRetrying(): void {
	if (!retryTimer) return;
	clearInterval(retryTimer);
	retryTimer = null;
}

function start(): void {
	if (patchMediaManager()) return;
	retryTimer = setInterval(() => {
		if (!patchMediaManager()) return;
		stopRetrying();
	}, 1000);
}

function stop(): void {
	stopRetrying();
	for (const unpatch of unpatches.splice(0)) {
		try {
			unpatch();
		} catch {}
	}
	PATCHER.unpatchAll();
	mediaManager = null;
}

export default { start, stop };

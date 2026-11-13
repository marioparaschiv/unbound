export type Engine = 'google' | 'yandex' | 'saucenao' | 'iqdb' | 'bing' | 'tineye' | 'imgops';

export const ENGINES: Record<Engine, string> = {
	google: 'https://lens.google.com/uploadbyurl?url=',
	yandex: 'https://yandex.com/images/search?rpt=imageview&url=',
	saucenao: 'https://saucenao.com/search.php?url=',
	iqdb: 'https://iqdb.org/?url=',
	bing: 'https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:',
	tineye: 'https://www.tineye.com/search?url=',
	imgops: 'https://imgops.com/start?url=',
};

const URL_KEYS = ['url', 'uri', 'sourceURI', 'originalURI', 'proxyURL'] as const;

/**
 * @description Builds an engine's search page for an image.
 * @param engine The engine.
 * @param imageUrl The image's address.
 * @returns The search page's address.
 */
export function searchUrl(engine: Engine, imageUrl: string): string {
	return `${ENGINES[engine]}${encodeURIComponent(imageUrl)}`;
}

/**
 * @description Finds the web address of the image the media viewer shows, from its media source.
 * @param source The source Discord passes the share actions.
 * @returns The first http address among its address fields, or `undefined` for local or missing media.
 */
export function imageUrlOf(source: unknown): string | undefined {
	if (typeof source !== 'object' || source === null) return undefined;

	const record = source as Record<string, unknown>;

	for (const key of URL_KEYS) {
		const value = record[key];

		if (typeof value === 'string' && /^https?:\/\//.test(value)) return value;
	}

	return undefined;
}

export default { ENGINES, searchUrl, imageUrlOf };

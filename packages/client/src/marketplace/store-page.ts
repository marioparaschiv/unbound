import {
	MEASURED_PAGE_FILENAME,
	addonPageSchema,
	splitFrontmatter,
	type AddonPage,
	type MeasuredMedia,
} from '@unbound-app/contracts/addon-page';

/** A version's store page as the CDN serves it beside the bundle. */
export type StorePage = {
	/** ADDON.md after its frontmatter. */
	body: string;
	/** The measured `page.json`, or `null` when the version has none, so the page shows no media. */
	measured: AddonPage | null;
	/** The version folder's URL, ending in `/`, that media paths resolve against. */
	folder: string;
};

/** A measured media file and the CDN URL it loads from. */
export type PageMediaFile = MeasuredMedia & { url: string };

/** A run of the body: Markdown rendered as text, or a line that holds only an image or video. */
export type PageBlock =
	| { kind: 'markdown'; source: string }
	| { kind: 'media'; alt: string; path: string };

const MEDIA_LINE = /^\s*!\[([^\]\n]*)\]\(\s*([^)\s]+)\s*\)\s*$/;
const FENCE = /^\s*(?:```|~~~)/;

async function fetchText(url: string): Promise<string | null> {
	const response = await fetch(url);

	if (response.status === 404) return null;

	if (!response.ok) {
		throw new Error(`${url} answered ${response.status}.`);
	}

	return response.text();
}

function parseMeasured(text: string | null): AddonPage | null {
	if (text === null) return null;

	try {
		const parsed = addonPageSchema.safeParse(JSON.parse(text));

		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/**
 * @description Fetches a version's store page: ADDON.md at `pageUrl` and the measured `page.json` beside it.
 * @param pageUrl The catalog version's `pageUrl`.
 * @returns The page, or `null` when ADDON.md is not on the CDN; throws when the CDN fails.
 */
export async function fetchStorePage(pageUrl: string): Promise<StorePage | null> {
	const folder = pageUrl.slice(0, pageUrl.lastIndexOf('/') + 1);
	const [addonMd, measured] = await Promise.all([
		fetchText(pageUrl),
		fetchText(folder + MEASURED_PAGE_FILENAME).catch(() => null),
	]);

	if (addonMd === null) return null;

	return { body: splitFrontmatter(addonMd).body, measured: parseMeasured(measured), folder };
}

/**
 * @description Finds a media file the page measured, so only files the server checked are shown.
 * @param page The store page.
 * @param path The media path ADDON.md writes, such as `media/banner.png`.
 * @returns The measured file and its URL, or `undefined` when the page did not measure it.
 */
export function findPageMedia(page: StorePage, path: string): PageMediaFile | undefined {
	const media = page.measured?.media.find((measured) => measured.path === path);

	return media ? { ...media, url: page.folder + media.path } : undefined;
}

/**
 * @description Cuts the body at each line that holds only an image or video, outside code fences, so
 * media lay out as blocks between runs of text.
 * @param body ADDON.md after its frontmatter.
 * @returns The Markdown runs and media lines in order, without blank runs.
 */
export function splitPageBody(body: string): PageBlock[] {
	const blocks: PageBlock[] = [];
	let lines: string[] = [];
	let fenced = false;

	function flush() {
		const source = lines.join('\n');

		if (source.trim()) {
			blocks.push({ kind: 'markdown', source });
		}

		lines = [];
	}

	for (const line of body.split('\n')) {
		if (FENCE.test(line)) {
			fenced = !fenced;
		}

		const media = fenced ? null : MEDIA_LINE.exec(line);

		if (!media) {
			lines.push(line);

			continue;
		}

		flush();
		blocks.push({ kind: 'media', alt: media[1] ?? '', path: media[2] ?? '' });
	}

	flush();

	return blocks;
}

export default { fetchStorePage, findPageMedia, splitPageBody };

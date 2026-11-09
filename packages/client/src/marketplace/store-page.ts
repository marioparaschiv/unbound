import {
	MEASURED_PAGE_FILENAME,
	STORE_PAGE_FILENAME,
	splitFrontmatter,
} from '@unbound-app/contracts/addon-page-text';
import type {
	AddonPage,
	MeasuredMedia,
	PublishedStorePage,
} from '@unbound-app/contracts/addon-page';

import { readServerJson } from '~/core/server-data';

/** A version's store page as the CDN serves it beside the bundle. */
export type StorePage = {
	/** ADDON.md after its frontmatter. */
	body: string;
	/** The measured `page.json`, or `null` when the version has none, so the page shows no media. */
	measured: AddonPage | null;
	/** Each `:name:` icon's SVG from the version's sprite; empty when it has none, so the icons are left out. */
	icons: Map<string, string>;
	/** The version folder's URL, ending in `/`, that media paths resolve against. */
	folder: string;
};

/** A measured media file and the CDN URL it loads from. */
export type PageMediaFile = MeasuredMedia & { url: string };

const FENCE = /^\s*(?:```|~~~)/;
const HEADING = /^ {0,3}#{1,6}\s/;
const LIST_ITEM = /^(?:[*+-]|\d+\.)\s/;
const INDENTED = /^\s/;

// Versions are immutable on the CDN, so a page fetched once serves every later visit this session.
const pages = new Map<string, Promise<StorePage | null>>();

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
		// The server validated the page and wrote its parsed form when it published the version.
		return readServerJson<AddonPage>(text);
	} catch {
		return null;
	}
}

// A version published before `store-page.json` has only ADDON.md and `page.json`, and no icons.
async function fetchLegacyStorePage(pageUrl: string, folder: string): Promise<StorePage | null> {
	const [addonMd, measured] = await Promise.all([
		fetchText(pageUrl),
		fetchText(folder + MEASURED_PAGE_FILENAME).catch(() => null),
	]);

	if (addonMd === null) return null;

	return {
		body: splitFrontmatter(addonMd).body,
		measured: parseMeasured(measured),
		icons: new Map(),
		folder,
	};
}

/**
 * @description Fetches a version's store page in one request: the `store-page.json` beside ADDON.md, or
 * ADDON.md and `page.json` for a version published before it.
 * @param pageUrl The catalog version's `pageUrl`.
 * @returns The page, or `null` when ADDON.md is not on the CDN; throws when the CDN fails.
 */
export async function fetchStorePage(pageUrl: string): Promise<StorePage | null> {
	const folder = pageUrl.slice(0, pageUrl.lastIndexOf('/') + 1);
	const text = await fetchText(folder + STORE_PAGE_FILENAME);

	if (text === null) {
		return fetchLegacyStorePage(pageUrl, folder);
	}

	// The server wrote the file from the page it validated when it published the version.
	const file = readServerJson<PublishedStorePage>(text);

	return {
		body: file.body,
		measured: file.measured,
		icons: new Map(Object.entries(file.icons)),
		folder,
	};
}

/**
 * @description Fetches a version's store page once per session, sharing the request between callers.
 * @param pageUrl The catalog version's `pageUrl`.
 * @returns The page, or `null` when ADDON.md is not on the CDN; a failure is not kept, so a retry fetches again.
 */
export function loadStorePage(pageUrl: string): Promise<StorePage | null> {
	const cached = pages.get(pageUrl);

	if (cached) {
		return cached;
	}

	const request = fetchStorePage(pageUrl);

	pages.set(pageUrl, request);
	request.catch(() => pages.delete(pageUrl));

	return request;
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

// A heading, a fence, or a list right under a paragraph starts a new block, as CommonMark reads it.
function startsBlock(line: string, previous: string): boolean {
	if (previous.trim() === '') {
		return false;
	}

	if (HEADING.test(line) || FENCE.test(line)) {
		return true;
	}

	return LIST_ITEM.test(line) && !LIST_ITEM.test(previous) && !INDENTED.test(previous);
}

/**
 * @description Puts blank lines around each heading and code fence, and before each list that follows
 * a paragraph, since simple-markdown only ends a block at a blank line. Fenced lines stay as written.
 * @param body ADDON.md after its frontmatter.
 * @returns The body, ending in the blank line the block parser needs.
 */
export function normalizePageBody(body: string): string {
	const lines: string[] = [];
	let fenced = false;
	let previous = '';

	for (const line of body.replaceAll('\r\n', '\n').split('\n')) {
		if (!fenced && startsBlock(line, previous)) {
			lines.push('');
		}

		lines.push(line);

		if (FENCE.test(line)) {
			fenced = !fenced;
		}

		if (!fenced && (HEADING.test(line) || FENCE.test(line))) {
			lines.push('');
		}

		previous = line;
	}

	return `${lines.join('\n')}\n\n`;
}

export default { fetchStorePage, loadStorePage, findPageMedia, normalizePageBody };

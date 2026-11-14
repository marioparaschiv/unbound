import type { Raster } from '~/native/ios/rasterize';

/** Where each SVG stands: being drawn, drawn to a PNG, or failed. */
export type Entry =
	| { state: 'pending' }
	| { state: 'failed' }
	| ({ state: 'ready'; png: string } & Raster);

const entries = new Map<string, Entry>();

/**
 * @description Reads what is known about an SVG URL.
 * @param url The attachment URL.
 * @returns The entry, or `undefined` when nothing has been tried yet.
 */
export function entryFor(url: string): Entry | undefined {
	return entries.get(url);
}

/**
 * @description Records what happened to an SVG URL.
 * @param url The attachment URL.
 * @param entry Its new state.
 */
export function setEntry(url: string, entry: Entry): void {
	entries.set(url, entry);
}

/**
 * @description Forgets every drawn SVG.
 */
export function clearEntries(): void {
	entries.clear();
}

/**
 * @description Names an SVG's files by a short hash of its URL, so each attachment is drawn once per session.
 * @param url The attachment URL.
 * @returns A file-safe name.
 */
export function fileNameFor(url: string): string {
	let hash = 5381;

	for (let index = 0; index < url.length; index++)
		hash = ((hash << 5) + hash + url.charCodeAt(index)) >>> 0;

	return hash.toString(36);
}

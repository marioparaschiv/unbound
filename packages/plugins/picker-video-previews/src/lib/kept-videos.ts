const MEGABYTE = 1024 * 1024;

/** How many bytes of downloaded videos the plugin keeps alive at most, past the newest one. */
export const KEPT_BYTES = 500 * MEGABYTE;

/** How many videos the plugin keeps alive at most. */
export const KEPT_VIDEOS = 3;

/** A video asset kept alive so its downloaded file stays on disk, with that file's size. */
export type KeptVideo<T> = { handle: T; bytes: number };

/**
 * @description Trims the kept videos, oldest first, to a few and to a total file size. The newest always stays, so the
 * preview that just opened keeps its file however large it is.
 * @template T The asset handle.
 * @param videos The kept videos, oldest first, the newest last.
 * @param maxBytes The total size to stay within.
 * @param maxCount How many to keep at most.
 * @returns The videos to keep, oldest first.
 */
export function keptWithin<T>(
	videos: KeptVideo<T>[],
	maxBytes = KEPT_BYTES,
	maxCount = KEPT_VIDEOS,
): KeptVideo<T>[] {
	const kept: KeptVideo<T>[] = [];
	let total = 0;

	for (const video of [...videos].reverse()) {
		if (kept.length && (kept.length >= maxCount || total + video.bytes > maxBytes)) break;

		kept.unshift(video);
		total += video.bytes;
	}

	return kept;
}

export default { keptWithin, KEPT_BYTES, KEPT_VIDEOS };

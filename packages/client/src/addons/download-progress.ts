/** Called as an addon's files download: how many have settled, of how many. */
export type DownloadListener = (done: number, total: number) => void;

const listeners = new Map<string, DownloadListener>();

/**
 * @description Listens to the file downloads of one addon, such as an icon pack's images, while it installs.
 * @param id The addon's id.
 * @param listener Called after each file settles.
 * @returns A function that stops listening.
 */
export function watchDownload(id: string, listener: DownloadListener): () => void {
	listeners.set(id, listener);

	return () => {
		if (listeners.get(id) === listener) {
			listeners.delete(id);
		}
	};
}

/**
 * @description Reports that more of an addon's files settled, to the listener watching it, if any.
 * @param id The addon's id.
 * @param done The files settled so far.
 * @param total The files to download.
 */
export function reportDownload(id: string, done: number, total: number): void {
	listeners.get(id)?.(done, total);
}

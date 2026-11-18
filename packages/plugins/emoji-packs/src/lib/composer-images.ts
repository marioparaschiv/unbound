import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';
import { fs } from '@unbound-app/api';

const IMAGE_POLL_MS = 400;
const IMAGE_FOLDER = 'Unbound/Temp/unbound.emoji-packs/composer';

async function download(url: string): Promise<string | undefined> {
	try {
		const response = await fetch(url);

		if (!response.ok) return undefined;

		const name = url.replace(/[^A-Za-z0-9.]/g, '_').slice(-120);
		const path = `${IMAGE_FOLDER}/${name}`;

		await fs.writeFile(path, toBase64(new Uint8Array(await response.arrayBuffer())), 'base64');

		return `${fs.documentsPath}/${path}`;
	} catch (error) {
		logger.warn(`Failed to download emoji image ${url}:`, error);

		return undefined;
	}
}

/**
 * @description Downloads the pack images the native composer asks for and hands them over as files, since the UI
 * thread must not wait on the network.
 * @param take Hands downloaded images to the composer and returns the URLs it still wants.
 * @returns A function that stops downloading.
 */
export function feedComposerImages(
	take: (files: Record<string, string>) => Promise<string[]>,
): () => void {
	const loading = new Set<string>();
	let ready: Record<string, string> = {};
	let stopped = false;

	async function tick() {
		if (stopped) return;

		const handed = ready;

		ready = {};

		const wanted = await take(handed).catch(() => [] as string[]);

		for (const url of wanted) {
			if (loading.has(url)) continue;

			loading.add(url);
			void download(url).then((path) => {
				if (path) ready[url] = path;
			});
		}

		setTimeout(() => void tick(), IMAGE_POLL_MS);
	}

	void tick();

	return () => {
		stopped = true;
	};
}

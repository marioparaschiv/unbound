import { unboundRelativePath } from '~/native/unbound-path';
import fs from '~/native/fs';

/**
 * @description Saves a URL's response to a file. The loader downloads it natively when the path lies in
 * the Unbound folder; otherwise the bytes pass through JS as base64.
 * @param url The URL to download.
 * @param path The file path, relative to the documents directory.
 * @returns A promise resolving once the file is written; it rejects on a failed request.
 */
export async function downloadFile(url: string, path: string): Promise<void> {
	const bridge = globalThis.UnboundNative;
	const relative = unboundRelativePath(path);

	if (bridge && relative) {
		return bridge.downloadFile(url, relative);
	}

	const res = await fetch(url, { cache: 'no-cache' });

	if (!res.ok) {
		throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
	}

	await fs.writeFile(path, Buffer.from(await res.arrayBuffer()).toString('base64'), 'base64');
}

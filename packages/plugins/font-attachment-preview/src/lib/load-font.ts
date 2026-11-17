import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';
import { fs } from '@unbound-app/api';

import type { FontHost } from '@unbound-plugins/shared/native/fonts/font-host';
import { familyName, type FontAttachment } from '~/lib/font-file';
import { fontFormat, woffToSfnt } from '~/lib/woff';

const MAX_BYTES = 20 * 1024 * 1024;

export type LoadedFont = { family: string } | { problem: 'woff2' | 'unknown' | 'failed' };

const loads = new Map<string, Promise<LoadedFont>>();

async function download(url: string): Promise<Uint8Array> {
	const response = await fetch(url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const bytes = new Uint8Array(await response.arrayBuffer());

	if (bytes.byteLength > MAX_BYTES) throw new Error('the font is over 20 MB');

	return bytes;
}

async function load(
	host: FontHost,
	attachment: FontAttachment,
	folder: string,
): Promise<LoadedFont> {
	try {
		const bytes = await download(attachment.url!);
		const format = fontFormat(bytes);

		if (format === 'woff2' || format === 'unknown') return { problem: format };

		const sfnt = format === 'woff' ? woffToSfnt(bytes, host.inflate) : bytes;
		const family = familyName(attachment);
		const path = `${folder}/fonts/${family}.ttf`;

		await fs.writeFile(path, toBase64(sfnt), 'base64');

		return { family: await host.register(`${fs.documentsPath}/${path}`, family) };
	} catch (error) {
		logger.error(`Failed to load font ${attachment.filename ?? attachment.url}:`, error);

		return { problem: 'failed' };
	}
}

/**
 * @description Downloads a font attachment and registers it with the system once per session.
 * @param host The platform's font loader.
 * @param attachment The font attachment.
 * @param folder The plugin's temporary folder, relative to the documents directory.
 * @returns The `fontFamily` to draw it with, or why it can't be shown.
 */
export function loadFont(
	host: FontHost,
	attachment: FontAttachment,
	folder: string,
): Promise<LoadedFont> {
	const key = attachment.url ?? '';
	const cached = loads.get(key);

	if (cached) return cached;

	const loading = load(host, attachment, folder).then((result) => {
		if ('problem' in result) loads.delete(key);

		return result;
	});

	loads.set(key, loading);

	return loading;
}

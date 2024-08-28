import fs, { type FileManagerEncoding } from '@api/fs';

/**
 * @description Downloads a file to the specified path in the specified encoding (utf8 by default).
 * @param url The URL of the file you would like to download.
 * @param path The file path to save this file to, including the file name.
 * @param encoding The encoding used when saving the file. (Default: utf8)
 * @param signal An abort signal for the request. (Optional)
 * @returns A promise with no valuable information.
 */
async function download(url: string, path: string, encoding: FileManagerEncoding = 'utf8', signal?: AbortSignal) {
	const res = await fetch(url, { cache: 'no-cache', signal });
	const data = await res.text();

	return await fs.write(path, data, encoding);
}

export default download;
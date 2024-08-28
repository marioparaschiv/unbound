import fs from '@api/fs';

async function downloadFile(url: string, path: string, signal: AbortSignal) {
	const res = await fetch(url, { signal });
	const arrayBuffer = await res.arrayBuffer();
	const data = Buffer.from(arrayBuffer).toString('base64');

	return await fs.write(path, data, 'base64');
}

export default downloadFile;
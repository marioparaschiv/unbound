import { DCDFileManager } from '@api/storage';

async function downloadFile(url: string, path: string, signal: AbortSignal) {
	const res = await fetch(url, { signal });
	const arrayBuffer = await res.arrayBuffer();
	const data = Buffer.from(arrayBuffer).toString('base64');

	return await DCDFileManager.writeFile('documents', path, data, 'base64');
}

export default downloadFile;
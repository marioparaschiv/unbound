import { DCDFileManager } from '@api/storage';
import readAsArrayBuffer from '@utilities/readAsArrayBuffer';

async function downloadFile(url: string, path: string, signal: AbortSignal) {
	const res = await fetch(url, { signal });
	const blob = await res.blob();
	const arrayBuffer = await readAsArrayBuffer(blob);
	const data = Buffer.from(arrayBuffer).toString('base64');

	return await DCDFileManager.writeFile('documents', path, data, 'base64');
}

export default downloadFile;
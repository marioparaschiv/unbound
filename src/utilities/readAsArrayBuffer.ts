/**
 * @description Reads a blob as an array buffer. Resolves with the ArrayBuffer if successful or rejects if errored.
 * @param {Blob} blob - The blob to read as an ArrayBuffer
 * @return {ArrayBuffer | Error}
 */
function readAsArrayBuffer(blob: Blob) {
	return new Promise<ArrayBuffer>((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result as ArrayBuffer);
		reader.onerror = reject;
		reader.readAsArrayBuffer(blob);
	});
}

export default readAsArrayBuffer;
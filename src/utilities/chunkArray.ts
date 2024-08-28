/**
 * @description Splits an array into chunks of the specified size. Useful for concurrency.
 * @template T The type of the items inside of the array.
 * @param array The array instance to split into chunks.
 * @param size The desired size of each chunk.
 * @returns An array of arrays with a maximum item count of the desired size.
 */
function chunkArray<T extends any>(array: T[], size: number): T[][] {
	const chunks = [];

	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}

	return chunks;
}

export default chunkArray;
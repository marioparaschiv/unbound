/**
 * @description Splits an array into chunks of the specified size. Useful for concurrency.
 * @param {array} array - The array to split into chunks
 * @param {number} size - The size of each chunk
 * @return {array} Returns the array of chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];

    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }

    return chunks;
}

export default chunkArray;
/**
 * @description Returns a UUID of the requested length. (default: 30)
 * @param length The length of the randomized UUID.
 * @return Returns a random UUID.
 */
function uuid(length: number = 30): string {
	let uuid = '';

	do {
		const random = Math.random() * 16 | 0;
		uuid += (uuid.length == 12 ? 4 : (uuid.length == 16 ? (random & 3 | 8) : random)).toString(16);
	} while (uuid.length < length);

	return uuid;
};

export default uuid;
/**
 * @description Sets a property for as long as the returned function is not called, then puts the original back,
 * unless something else replaced the value in the meantime.
 * @template T The object's type.
 * @template K The property's key.
 * @param parent The object, such as a module's exports.
 * @param key The property to set.
 * @param value The value to set.
 * @returns Restores the original value or descriptor.
 */
export function assignValue<T extends object, K extends keyof T>(
	parent: T,
	key: K,
	value: T[K],
): () => void {
	const original = Object.getOwnPropertyDescriptor(parent, key);
	let restored = false;

	parent[key] = value;

	return () => {
		if (restored) return;

		restored = true;

		if (parent[key] !== value) return;

		if (original) {
			Object.defineProperty(parent, key, original);
		} else {
			Reflect.deleteProperty(parent, key);
		}
	};
}

export default assignValue;

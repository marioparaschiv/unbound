import uuid from '@unbound-app/utils/uuid';

// Hermes does not implement `WeakRef`, which `possess` (the patcher) needs. This minimal shim holds
// a strong reference instead of a weak one - the patch targets are long-lived globals, so never
// reclaiming them is acceptable here.
globalThis.WeakRef ??= class WeakRef<T extends WeakKey> {
	readonly [Symbol.toStringTag] = 'WeakRef';

	#value: T;

	constructor(value: T) {
		this.#value = value;
	}

	deref(): T | undefined {
		return this.#value;
	}
};

// Hermes does not provide `crypto.randomUUID`, which `possess` uses to name patch callers. Build a
// v4-shaped id from the `uuid` util's hex output.
globalThis.crypto ??= {} as Crypto;
globalThis.crypto.randomUUID ??= (() => {
	const hex = uuid(32);
	const v4 = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
	return v4 as `${string}-${string}-${string}-${string}-${string}`;
}) as Crypto['randomUUID'];

// Hermes does not implement Iterator Helpers, but `possess` calls `array.values().filter(...)`. Add
// the helpers `possess` (and our own iterator usage) relies on to the shared iterator prototype.
const IteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));

IteratorPrototype.filter ??= function* (this: Iterator<unknown>, predicate: (value: any) => boolean) {
	let next = this.next();
	for (let i = 0; !next.done; next = this.next(), i++) {
		if (predicate(next.value)) yield next.value;
	}
};

IteratorPrototype.map ??= function* (this: Iterator<unknown>, mapper: (value: any) => unknown) {
	let next = this.next();
	for (let i = 0; !next.done; next = this.next(), i++) {
		yield mapper(next.value);
	}
};

IteratorPrototype.toArray ??= function (this: Iterator<unknown>) {
	const result: unknown[] = [];
	for (let next = this.next(); !next.done; next = this.next()) result.push(next.value);
	return result;
};

const mdls = [...globalThis.modules.values()];

let reactNative, react;

for (const m of mdls) {
	const exports = m?.publicModule?.exports;
	if (!exports) continue;

	if (!reactNative && exports.AppState) reactNative = exports;
	if (!react && exports.createElement) react = exports;

	if (reactNative && react) break;
}

globalThis.ReactNative = reactNative;
globalThis.React = react;

export {};

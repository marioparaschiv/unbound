const MASK = (1n << 64n) - 1n;
const PRIME_1 = 0x9e3779b185ebca87n;
const PRIME_2 = 0xc2b2ae3d27d4eb4fn;
const PRIME_3 = 0x165667b19e3779f9n;
const PRIME_4 = 0x85ebca77c2b2ae63n;
const PRIME_5 = 0x27d4eb2f165667c5n;

const encoder = new TextEncoder();

const rotateLeft = (value: bigint, bits: bigint) =>
	((value << bits) | (value >> (64n - bits))) & MASK;

const round = (accumulator: bigint, input: bigint) =>
	(rotateLeft((accumulator + input * PRIME_2) & MASK, 31n) * PRIME_1) & MASK;

const mergeRound = (accumulator: bigint, value: bigint) =>
	((accumulator ^ round(0n, value)) * PRIME_1 + PRIME_4) & MASK;

function readLittleEndian(bytes: Uint8Array, offset: number, length: number): bigint {
	let value = 0n;

	for (let index = length - 1; index >= 0; index--) {
		value = (value << 8n) | BigInt(bytes[offset + index]);
	}

	return value;
}

function hashStripes(bytes: Uint8Array, seed: bigint): { hash: bigint; offset: number } {
	if (bytes.length < 32) return { hash: (seed + PRIME_5) & MASK, offset: 0 };

	const lanes = [
		(seed + PRIME_1 + PRIME_2) & MASK,
		(seed + PRIME_2) & MASK,
		seed,
		(seed - PRIME_1) & MASK,
	];
	let offset = 0;

	for (; offset + 32 <= bytes.length; offset += 32) {
		for (let lane = 0; lane < 4; lane++) {
			lanes[lane] = round(lanes[lane], readLittleEndian(bytes, offset + lane * 8, 8));
		}
	}

	const [first, second, third, fourth] = lanes;
	let hash =
		(rotateLeft(first, 1n) +
			rotateLeft(second, 7n) +
			rotateLeft(third, 12n) +
			rotateLeft(fourth, 18n)) &
		MASK;

	for (const lane of lanes) hash = mergeRound(hash, lane);

	return { hash, offset };
}

/**
 * @description Hashes a string's UTF-8 bytes with XXH64, matching `Bun.hash.xxHash64` and Vencord's `@intrnl/xxhash64`.
 * @param text The string to hash.
 * @param seed The XXH64 seed.
 * @returns The unsigned 64-bit hash.
 */
export function xxHash64(text: string, seed = 0n): bigint {
	const bytes = encoder.encode(text);
	let { hash, offset } = hashStripes(bytes, seed);

	hash = (hash + BigInt(bytes.length)) & MASK;

	for (; offset + 8 <= bytes.length; offset += 8) {
		hash ^= round(0n, readLittleEndian(bytes, offset, 8));
		hash = (rotateLeft(hash, 27n) * PRIME_1 + PRIME_4) & MASK;
	}

	if (offset + 4 <= bytes.length) {
		hash ^= (readLittleEndian(bytes, offset, 4) * PRIME_1) & MASK;
		hash = (rotateLeft(hash, 23n) * PRIME_2 + PRIME_3) & MASK;
		offset += 4;
	}

	for (; offset < bytes.length; offset++) {
		hash ^= (BigInt(bytes[offset]) * PRIME_5) & MASK;
		hash = (rotateLeft(hash, 11n) * PRIME_1) & MASK;
	}

	hash ^= hash >> 33n;
	hash = (hash * PRIME_2) & MASK;
	hash ^= hash >> 29n;
	hash = (hash * PRIME_3) & MASK;

	return hash ^ (hash >> 32n);
}

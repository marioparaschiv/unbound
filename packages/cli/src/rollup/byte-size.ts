/** A size in bytes, or a string such as `50kb`, `1.5mb` or `800b`. Units are binary: 1 KB is 1024 bytes. */
export type ByteSize = number | `${number}${'b' | 'kb' | 'mb'}`;

const UNITS = { b: 1, kb: 1024, mb: 1024 * 1024 } as const;

const SIZE = /^(\d+(?:\.\d+)?)\s*(b|kb|mb)?$/i;

/**
 * @description Reads a budget size such as `50kb` as bytes.
 * @param size The size, in bytes or with a `b`, `kb` or `mb` unit.
 * @returns The size in bytes.
 */
export function parseByteSize(size: ByteSize): number {
	if (typeof size === 'number') {
		return size;
	}

	const match = SIZE.exec(size.trim());

	if (!match) {
		throw new Error(`"${size}" is not a size. Write bytes, or a number with b, kb or mb.`);
	}

	const unit = (match[2]?.toLowerCase() ?? 'b') as keyof typeof UNITS;

	return Math.round(Number(match[1]) * UNITS[unit]);
}

/**
 * @description Renders a byte count for the build report, such as `18.4 KB`.
 * @param bytes The size in bytes.
 * @returns The size with one decimal and its unit.
 */
export function formatBytes(bytes: number): string {
	if (bytes < UNITS.kb) {
		return `${bytes} B`;
	}

	if (bytes < UNITS.mb) {
		return `${(bytes / UNITS.kb).toFixed(1)} KB`;
	}

	return `${(bytes / UNITS.mb).toFixed(1)} MB`;
}

export default { parseByteSize, formatBytes };

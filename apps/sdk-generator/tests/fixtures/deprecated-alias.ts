/**
 * @description The current name of the fixture function.
 * @returns A fixed string.
 */
export function next(): string {
	return 'next';
}

/** @deprecated Use next */
export const old = next;

export default { next, old };

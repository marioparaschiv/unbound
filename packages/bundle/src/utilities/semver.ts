const Collator = new Intl.Collator([], { numeric: true });

/**
 * @description Checks if versionA is greater than versionB.
 */
export function isGreater(versionA: string, versionB: string): boolean {
	return Collator.compare(versionA, versionB) === 1;
}

/**
 * @description Checks if versionA is less than versionB.
 */
export function isLess(versionA: string, versionB: string): boolean {
	return Collator.compare(versionA, versionB) === -1;
}

/**
 * @description Compares 2 semantic versions for equality.
 */
export function isEqual(versionA: string, versionB: string): boolean {
	return Collator.compare(versionA, versionB) === 0;
}

/**
 * @description Compares 2 semantic versions.
 * @returns
 * A number indicating the comparison result between versions.
 *
 * @ If the number is 1, versionA is newer than versionB.
 * @ If the number is 0, both versions are the same.
 * @ If the number is -1, versionA is older than versionB.
 */
export function compare(versionA: string, versionB: string) {
	return Collator.compare(versionA, versionB);
}

export default { isGreater, isLess, compare };
function parseVersion(version: string): [core: number[], prerelease: string[]] {
	const [release = ''] = version.split('+');
	const dash = release.indexOf('-');
	const core = (dash === -1 ? release : release.slice(0, dash)).split('.').map(Number);

	return [core, dash === -1 ? [] : release.slice(dash + 1).split('.')];
}

function compareIdentifiers(a: string, b: string): number {
	const numeric = /^\d+$/;

	if (numeric.test(a) && numeric.test(b)) {
		return Number(a) - Number(b);
	}

	if (numeric.test(a) !== numeric.test(b)) {
		return numeric.test(a) ? -1 : 1;
	}

	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * @description Compares two semver versions by precedence, ignoring build metadata.
 * @param a The first version.
 * @param b The second version.
 * @returns A negative number when `a` is older, positive when newer, `0` when equal.
 */
export function compareVersions(a: string, b: string): number {
	const [coreA, preA] = parseVersion(a);
	const [coreB, preB] = parseVersion(b);

	for (let i = 0; i < 3; i++) {
		const difference = (coreA[i] ?? 0) - (coreB[i] ?? 0);

		if (difference) {
			return difference;
		}
	}

	// A release sorts after its prereleases.
	if (!preA.length || !preB.length) {
		return preB.length - preA.length;
	}

	for (let i = 0, len = Math.min(preA.length, preB.length); i < len; i++) {
		const difference = compareIdentifiers(preA[i] ?? '', preB[i] ?? '');

		if (difference) {
			return difference;
		}
	}

	return preA.length - preB.length;
}

export default { compareVersions };

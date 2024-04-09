/**
 * @description Compares 2 semantic versions.
 * @cases
 * @> 0 - versionA is newer than versionB
 * @< 0 - versionA is older than versionB
 * @= 0 - versionA and versionB are the same
 * @param {T extends string} versionA
 * @param {T extends string} versionB
 * @return {number}
 */

function compareSemanticVersions(versionA: string, versionB: string): number {
	const [majorA, minorA, patchA] = versionA.split('.').map(Number);
	const [majorB, minorB, patchB] = versionB.split('.').map(Number);

	if (majorA !== majorB) {
		return majorA - majorB;
	}

	if (minorA !== minorB) {
		return minorA - minorB;
	}

	return patchA - patchB;
}

export default compareSemanticVersions;
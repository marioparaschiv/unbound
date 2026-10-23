export type ServableVersion = {
	version: string;
	/** The rollback event that withdrew it; `null` is live. */
	withdrawnBy: number | null;
};

export type ServePlan = {
	/** The version served before; `null` when none is live. */
	previous: string | null;
	/** Live versions above the target, newest first, that the rollback withdraws. */
	withdrawn: string[];
	/** The target and every lower version the rollback that withdrew it withdrew, newest first. */
	restored: string[];
};

/**
 * @description Works out what serving `version` changes. Every live version above it is withdrawn.
 * If it was withdrawn, it comes back with every lower version the same rollback withdrew, so serving
 * the pre-rollback version undoes that rollback exactly. Serving the served version changes nothing.
 * Shared by the server and the confirmation dialog so both name the same versions.
 * @param versions Every version of the addon, newest first.
 * @param version The version to serve.
 * @returns The plan, or `undefined` when the addon has no such version.
 */
export function planServe(versions: ServableVersion[], version: string): ServePlan | undefined {
	const index = versions.findIndex((entry) => entry.version === version);
	const target = versions[index];

	if (!target) return;

	const cause = target.withdrawnBy;

	return {
		previous: versions.find((entry) => entry.withdrawnBy === null)?.version ?? null,
		withdrawn: versions
			.slice(0, index)
			.filter((entry) => entry.withdrawnBy === null)
			.map((entry) => entry.version),
		restored:
			cause === null
				? []
				: versions
						.slice(index)
						.filter((entry) => entry.withdrawnBy === cause)
						.map((entry) => entry.version),
	};
}

export default { planServe };

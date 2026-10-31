import {
	MAIN_DOCS_VERSION,
	type DocsManifest,
	type DocsPackage,
	type DocsVersion,
} from '@unbound-app/contracts/docs';

/**
 * @description Orders docs versions the way the version select lists them: `main` first, then release tags newest first.
 * @param a One version.
 * @param b The other version.
 * @returns A negative number when `a` comes first.
 */
export function compareDocsVersions(a: DocsVersion, b: DocsVersion): number {
	if (a === b) {
		return 0;
	}

	if (a === MAIN_DOCS_VERSION) {
		return -1;
	}

	if (b === MAIN_DOCS_VERSION) {
		return 1;
	}

	return Bun.semver.order(b.slice(1), a.slice(1));
}

/**
 * @description Adds a version to a package's manifest, keeping every version it already lists. Adding a listed version changes nothing.
 * @param manifest The current manifest, or `undefined` when none was published yet.
 * @param pkg The documented package.
 * @param version The version to add.
 * @returns The merged manifest, its versions deduplicated and ordered by {@link compareDocsVersions}.
 */
export function mergeDocsManifest(
	manifest: DocsManifest | undefined,
	pkg: DocsPackage,
	version: DocsVersion,
): DocsManifest {
	const versions = new Set(manifest?.versions);

	versions.add(version);

	return { package: pkg, versions: [...versions].sort(compareDocsVersions) };
}

export default { compareDocsVersions, mergeDocsManifest };

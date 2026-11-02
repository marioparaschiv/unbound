import { Type, type Static } from './schema';
import { SEMVER_PATTERN } from './manifest';

/** The development docs, rebuilt from every push to main. */
export const MAIN_DOCS_VERSION = 'main';

/** The packages the site documents; each one is `docs/<package>/` in the public bucket. */
export const docsPackageSchema = Type.Enum(['api']);

/** `main`, or a client release tag such as `v1.2.3`. */
export const docsVersionSchema = Type.Union([
	Type.Literal(MAIN_DOCS_VERSION),
	Type.String({ pattern: `^v${SEMVER_PATTERN}$` }),
]);

/** `docs/<package>/versions.json`: `main` first, then the release tags newest first. */
export const docsManifestSchema = Type.Object({
	package: docsPackageSchema,
	versions: Type.Array(docsVersionSchema),
});

export type DocsPackage = Static<typeof docsPackageSchema>;

export type DocsVersion = Static<typeof docsVersionSchema>;

export type DocsManifest = Static<typeof docsManifestSchema>;

/**
 * @description Builds the public bucket key of one version's TypeDoc JSON.
 * @param pkg The documented package.
 * @param version The docs version.
 * @returns `docs/<package>/<version>.json`.
 */
export function getDocsKey(pkg: DocsPackage, version: DocsVersion): string {
	return `docs/${pkg}/${version}.json`;
}

/**
 * @description Builds the public bucket key of a package's version manifest.
 * @param pkg The documented package.
 * @returns `docs/<package>/versions.json`.
 */
export function getDocsManifestKey(pkg: DocsPackage): string {
	return `docs/${pkg}/versions.json`;
}

/**
 * @description Picks the version `/docs` opens: the newest release, else `main`.
 * @param manifest The package's manifest, ordered as {@link docsManifestSchema} describes.
 * @returns The version.
 */
export function getLatestDocsVersion(manifest: DocsManifest): DocsVersion {
	return manifest.versions.find((version) => version !== MAIN_DOCS_VERSION) ?? MAIN_DOCS_VERSION;
}

export default {
	MAIN_DOCS_VERSION,
	getLatestDocsVersion,
	docsPackageSchema,
	docsVersionSchema,
	docsManifestSchema,
	getDocsKey,
	getDocsManifestKey,
};

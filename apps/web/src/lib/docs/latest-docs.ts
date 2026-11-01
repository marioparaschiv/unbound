import {
	docsPackageSchema,
	getLatestDocsVersion,
	type DocsManifest,
	type DocsPackage,
} from '@unbound-app/contracts/docs';
import { notFound, redirect } from '@tanstack/react-router';

/** The `$version` that stands for the newest release, so links outlive releases: `/docs/api/latest/storage`. */
export const LATEST_DOCS_ALIAS = 'latest';

type ManifestLoader = (pkg: DocsPackage) => Promise<DocsManifest | null>;

/**
 * @description Sends a request for the latest docs to the newest release, or `main` before the first one.
 * @param loadManifest Reads a package's manifest, such as through the router's query client.
 * @param pkg The `$package` param.
 * @param symbol The open symbol, kept across the redirect.
 * @returns Never: it throws the redirect, or a not-found for an unknown package.
 */
export async function redirectToLatestDocs(
	loadManifest: ManifestLoader,
	pkg: string,
	symbol?: string,
): Promise<never> {
	const parsed = docsPackageSchema.safeParse(pkg);
	const manifest = parsed.success ? await loadManifest(parsed.data) : null;

	if (!manifest) {
		throw notFound();
	}

	const version = getLatestDocsVersion(manifest);

	throw symbol
		? redirect({
				to: '/docs/$package/$version/$symbol',
				params: { package: manifest.package, version, symbol },
			})
		: redirect({
				to: '/docs/$package/$version',
				params: { package: manifest.package, version },
			});
}

export default { LATEST_DOCS_ALIAS, redirectToLatestDocs };

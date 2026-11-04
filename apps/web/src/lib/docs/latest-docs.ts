import {
	getLatestDocsVersion,
	type DocsManifest,
	type DocsPackage,
} from '@unbound-app/contracts/docs';
import { notFound, redirect } from '@tanstack/react-router';

import { SDK_DOCS_PACKAGE } from '~/lib/docs/docs-links';

/** The `$version` that stands for the newest release, so links outlive releases: `/docs/sdk/latest/storage`. */
export const LATEST_DOCS_ALIAS = 'latest';

type ManifestLoader = (pkg: DocsPackage) => Promise<DocsManifest | null>;

/**
 * @description Sends a request for the latest SDK docs to the newest release, or `main` before the first one.
 * @param loadManifest Reads a package's manifest, such as through the router's query client.
 * @param symbol The open symbol, kept across the redirect.
 * @returns Never: it throws the redirect, or a not-found when no manifest is published.
 */
export async function redirectToLatestDocs(
	loadManifest: ManifestLoader,
	symbol?: string,
): Promise<never> {
	const manifest = await loadManifest(SDK_DOCS_PACKAGE);

	if (!manifest) {
		throw notFound();
	}

	const version = getLatestDocsVersion(manifest);

	throw symbol
		? redirect({ to: '/docs/sdk/$version/$symbol', params: { version, symbol } })
		: redirect({ to: '/docs/sdk/$version', params: { version } });
}

export default { LATEST_DOCS_ALIAS, redirectToLatestDocs };

import {
	docsPackageSchema,
	docsVersionSchema,
	type DocsManifest,
	type DocsPackage,
	type DocsVersion,
} from '@unbound-app/contracts/docs';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod/mini';

import { getDocsNav, getDocsPage, type DocsNav, type DocsPageData } from '~/lib/docs/docs-page';
import { createDocsSource } from '~/lib/docs/docs-source';
import type { DocsIndex } from '~/lib/docs/docs-index';
import { getCdnUrl } from '~/lib/artifacts';
import app from '~/lib/app';

const docs = createDocsSource({ cdnUrl: (key) => getCdnUrl(app.env, key) });

const versionParamsSchema = z.object({ package: docsPackageSchema, version: docsVersionSchema });

const symbolParamsSchema = z.extend(versionParamsSchema, { symbol: z.string() });

type LoadedVersion = {
	manifest: DocsManifest;
	index: DocsIndex;
};

async function loadVersion(
	pkg: DocsPackage,
	version: DocsVersion,
): Promise<LoadedVersion | undefined> {
	const manifest = await docs.manifest(pkg);

	if (!manifest?.versions.includes(version)) return;

	return { manifest, index: await docs.index(pkg, version) };
}

/**
 * @description Loads a package's published docs versions.
 * @returns The manifest, or `null` when no docs are published.
 */
export const fetchDocsManifest = createServerFn({ method: 'GET' })
	.validator(docsPackageSchema)
	.handler(async ({ data }): Promise<DocsManifest | null> => (await docs.manifest(data)) ?? null);

/**
 * @description Loads the sidebar of one docs version.
 * @returns The navigation, or `null` when the version is not published.
 */
export const fetchDocsNav = createServerFn({ method: 'GET' })
	.validator(versionParamsSchema)
	.handler(async ({ data }): Promise<DocsNav | null> => {
		const loaded = await loadVersion(data.package, data.version);

		return loaded
			? getDocsNav(loaded.index, data.package, data.version, loaded.manifest.versions)
			: null;
	});

/**
 * @description Loads one symbol page of a docs version.
 * @returns The page, or `null` when the version or the symbol does not exist.
 */
export const fetchDocsPage = createServerFn({ method: 'GET' })
	.validator(symbolParamsSchema)
	.handler(async ({ data }): Promise<DocsPageData | null> => {
		const loaded = await loadVersion(data.package, data.version);

		return (loaded && getDocsPage(loaded.index, data.symbol)) ?? null;
	});

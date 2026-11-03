import {
	docsPackageSchema,
	docsVersionSchema,
	type DocsManifest,
	type DocsPackage,
	type DocsVersion,
} from '@unbound-app/contracts/docs';
import { createServerFn } from '@tanstack/react-start';
import { Type } from '@unbound-app/contracts/schema';

import { getDocsNav, getDocsPage, type DocsNav, type DocsPageData } from '~/lib/docs/docs-page';
import { createDocsSource } from '~/lib/docs/docs-source';
import { schemaValidator } from '~/lib/schema-validator';
import type { DocsIndex } from '~/lib/docs/docs-index';
import { getCdnUrl } from '~/lib/artifacts';
import app from '~/lib/app';

const docs = createDocsSource({ cdnUrl: (key) => getCdnUrl(app.env, key) });

const versionParamsSchema = Type.Object({ package: docsPackageSchema, version: docsVersionSchema });

const symbolParamsSchema = Type.Object({
	...versionParamsSchema.properties,
	symbol: Type.String(),
});

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
	.validator(schemaValidator(docsPackageSchema))
	.handler(async ({ data }): Promise<DocsManifest | null> => (await docs.manifest(data)) ?? null);

/**
 * @description Loads the sidebar of one docs version.
 * @returns The navigation, or `null` when the version is not published.
 */
export const fetchDocsNav = createServerFn({ method: 'GET' })
	.validator(schemaValidator(versionParamsSchema))
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
	.validator(schemaValidator(symbolParamsSchema))
	.handler(async ({ data }): Promise<DocsPageData | null> => {
		const loaded = await loadVersion(data.package, data.version);

		return (loaded && getDocsPage(loaded.index, data.symbol)) ?? null;
	});

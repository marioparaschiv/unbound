import { addonIdSchema, addonManifestSchema, semverSchema } from '@unbound-app/contracts/manifest';
import { addonTypeSchema, sha256Schema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

const addonVersionSchema = Type.Object({
	version: semverSchema,
	manifest: addonManifestSchema,
	changelog: Type.Union([Type.String(), Type.Null()]),
	bundleSize: Type.Integer({ minimum: 1 }),
	sha256: sha256Schema,
	publishedAt: Type.String({ format: 'date-time' }),
	manifestUrl: Type.String({ format: 'url' }),
	bundleUrl: Type.String({ format: 'url' }),
});

const listedAddonSchema = Type.Object({
	id: addonIdSchema,
	type: addonTypeSchema,
	latestVersion: addonVersionSchema,
});

export const shippedCatalogResponseSchema = Type.Object({
	revision: Type.String({ minLength: 1 }),
	addons: Type.Array(listedAddonSchema),
});

const addonReleaseSchema = Type.Intersect([
	Type.Pick(addonVersionSchema, ['version', 'manifestUrl', 'bundleUrl', 'sha256', 'changelog']),
	Type.Object({ id: addonIdSchema }),
]);

const versionChangelogSchema = Type.Pick(addonVersionSchema, [
	'version',
	'changelog',
	'publishedAt',
]);

const addonUpdateSchema = Type.Intersect([
	addonReleaseSchema,
	Type.Object({
		changelogs: Type.Array(versionChangelogSchema, { default: [], maxItems: 20 }),
	}),
]);

export const shippedUpdatesResponseSchema = Type.Object({
	updates: Type.Array(addonUpdateSchema),
});

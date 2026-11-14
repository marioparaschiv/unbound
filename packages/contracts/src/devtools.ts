import { Type, type StaticDecode } from './schema';
import { MAX_UPDATE_CHANGELOGS } from './updates';
import { MAX_CHANGELOG_LENGTH } from './publish';
import { semverSchema } from './manifest';

/** The `<os>-<arch>` builds CI makes of the DevTools app, matching its release asset names. */
export const DEVTOOLS_TARGETS = [
	'macos-arm64',
	'macos-x64',
	'windows-x64',
	'windows-arm64',
	'linux-x64',
	'linux-arm64',
] as const;

export const devtoolsTargetSchema = Type.Enum(DEVTOOLS_TARGETS);

/** One target's archive: a `.tar.gz` on macOS and Linux, a `.zip` on Windows, holding the executable. */
export const devtoolsAssetSchema = Type.Object({
	target: devtoolsTargetSchema,
	url: Type.String({ format: 'url', pattern: /^https?:\/\//i }),
	/** SHA-256 of the archive as downloaded. */
	sha256: Type.String({
		pattern: '^[\\da-f]{64}$',
		errorMessage: 'Must be a lowercase SHA-256 digest.',
	}),
});

/** A published DevTools release with an archive per target. */
export const devtoolsReleaseSchema = Type.Object({
	version: semverSchema,
	assets: Type.Refine(
		Type.Array(devtoolsAssetSchema, { minItems: 1, maxItems: DEVTOOLS_TARGETS.length }),
		(assets) => new Set(assets.map((asset) => asset.target)).size === assets.length,
		() => 'Asset targets must be unique.',
	),
	changelog: Type.Union([Type.String({ maxLength: MAX_CHANGELOG_LENGTH }), Type.Null()]),
	publishedAt: Type.String({ format: 'date-time' }),
});

/** What CI posts for a release. Posting a version again replaces its `assets` and `changelog`. */
export const publishDevtoolsReleaseRequestSchema = Type.Object({
	...Type.Omit(devtoolsReleaseSchema, ['publishedAt']).properties,
	changelog: Type.Optional(devtoolsReleaseSchema.properties.changelog),
});

/** The app a user runs, as `GET /api/v1/devtools/updates` reads it from the query string. */
export const devtoolsUpdateQuerySchema = Type.Object({
	target: devtoolsTargetSchema,
	version: semverSchema,
});

/** One skipped release's entry in an update's `changelogs`. */
export const devtoolsChangelogSchema = Type.Pick(devtoolsReleaseSchema, [
	'version',
	'changelog',
	'publishedAt',
]);

/** The newest newer release built for the query's target, with that target's archive. */
export const devtoolsUpdateSchema = Type.Object({
	...Type.Pick(devtoolsReleaseSchema, ['version', 'changelog', 'publishedAt']).properties,
	...Type.Pick(devtoolsAssetSchema, ['url', 'sha256']).properties,
	/** Each version newer than the installed one, up to and including `version`, newest first. */
	changelogs: Type.Array(devtoolsChangelogSchema, { maxItems: MAX_UPDATE_CHANGELOGS }),
});

/** `update` is `null` when the installed app is the newest release built for its target. */
export const devtoolsUpdateResponseSchema = Type.Object({
	update: Type.Union([devtoolsUpdateSchema, Type.Null()]),
});

export type DevtoolsTarget = StaticDecode<typeof devtoolsTargetSchema>;
export type DevtoolsAsset = StaticDecode<typeof devtoolsAssetSchema>;
export type DevtoolsRelease = StaticDecode<typeof devtoolsReleaseSchema>;
export type PublishDevtoolsReleaseRequest = StaticDecode<
	typeof publishDevtoolsReleaseRequestSchema
>;
export type DevtoolsUpdateQuery = StaticDecode<typeof devtoolsUpdateQuerySchema>;
export type DevtoolsUpdateResponse = StaticDecode<typeof devtoolsUpdateResponseSchema>;

export default {
	DEVTOOLS_TARGETS,
	devtoolsTargetSchema,
	devtoolsAssetSchema,
	devtoolsReleaseSchema,
	publishDevtoolsReleaseRequestSchema,
	devtoolsUpdateQuerySchema,
	devtoolsChangelogSchema,
	devtoolsUpdateSchema,
	devtoolsUpdateResponseSchema,
};

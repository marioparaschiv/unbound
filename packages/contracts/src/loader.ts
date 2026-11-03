import { Type, type StaticDecode } from './schema';
import { MAX_UPDATE_CHANGELOGS } from './updates';
import { MAX_CHANGELOG_LENGTH } from './publish';
import { semverSchema } from './manifest';

export const loaderPlatformSchema = Type.Enum(['ios', 'android']);

/** A published native loader build. `url` is where a user gets it: a release page or a direct asset. */
export const loaderReleaseSchema = Type.Object({
	platform: loaderPlatformSchema,
	version: semverSchema,
	url: Type.String({ format: 'url', pattern: /^https?:\/\//i }),
	changelog: Type.Union([Type.String({ maxLength: MAX_CHANGELOG_LENGTH }), Type.Null()]),
	publishedAt: Type.String({ format: 'date-time' }),
});

/** What CI posts for a release. Posting a version again replaces its `url` and `changelog`. */
export const publishLoaderReleaseRequestSchema = Type.Object({
	...Type.Omit(loaderReleaseSchema, ['publishedAt']).properties,
	changelog: Type.Optional(loaderReleaseSchema.properties.changelog),
});

/** The loader a client runs, as `GET /api/v1/loader/updates` reads it from the query string. */
export const loaderUpdateQuerySchema = Type.Object({
	platform: loaderPlatformSchema,
	version: semverSchema,
});

/** One skipped release's entry in an update's `changelogs`. */
export const loaderChangelogSchema = Type.Pick(loaderReleaseSchema, [
	'version',
	'changelog',
	'publishedAt',
]);

/** The newest newer release, with `changelogs` covering every version it skips over. */
export const loaderUpdateSchema = Type.Object({
	...loaderReleaseSchema.properties,
	/** Each version newer than the installed one, up to and including `version`, newest first. */
	changelogs: Type.Array(loaderChangelogSchema, { maxItems: MAX_UPDATE_CHANGELOGS }),
});

/** `update` is `null` when the installed loader is the newest release it may move to. */
export const loaderUpdateResponseSchema = Type.Object({
	update: Type.Union([loaderUpdateSchema, Type.Null()]),
});

export type LoaderPlatform = StaticDecode<typeof loaderPlatformSchema>;
export type LoaderRelease = StaticDecode<typeof loaderReleaseSchema>;
export type PublishLoaderReleaseRequest = StaticDecode<typeof publishLoaderReleaseRequestSchema>;
export type LoaderChangelog = StaticDecode<typeof loaderChangelogSchema>;
export type LoaderUpdateQuery = StaticDecode<typeof loaderUpdateQuerySchema>;
export type LoaderUpdate = StaticDecode<typeof loaderUpdateSchema>;
export type LoaderUpdateResponse = StaticDecode<typeof loaderUpdateResponseSchema>;

export default {
	loaderPlatformSchema,
	loaderReleaseSchema,
	publishLoaderReleaseRequestSchema,
	loaderUpdateQuerySchema,
	loaderChangelogSchema,
	loaderUpdateSchema,
	loaderUpdateResponseSchema,
};

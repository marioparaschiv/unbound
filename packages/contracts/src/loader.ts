import { z } from 'zod';

import { MAX_UPDATE_CHANGELOGS, versionChangelogSchema } from './updates';
import { MAX_CHANGELOG_LENGTH } from './publish';
import { semverSchema } from './manifest';

export const loaderPlatformSchema = z.enum(['ios', 'android']);

/** A published native loader build. `url` is where a user gets it: a release page or a direct asset. */
export const loaderReleaseSchema = z.object({
	platform: loaderPlatformSchema,
	version: semverSchema,
	url: z.url({ protocol: /^https?$/ }),
	changelog: z.string().max(MAX_CHANGELOG_LENGTH).nullable(),
	publishedAt: z.iso.datetime(),
});

/** What CI posts for a release. Posting a version again replaces its `url` and `changelog`. */
export const publishLoaderReleaseRequestSchema = loaderReleaseSchema
	.omit({ publishedAt: true })
	.extend({ changelog: loaderReleaseSchema.shape.changelog.optional() });

/** The loader a client runs, as `GET /api/v1/loader/updates` reads it from the query string. */
export const loaderUpdateQuerySchema = z.object({
	platform: loaderPlatformSchema,
	version: semverSchema,
});

/** The newest newer release, with `changelogs` covering every version it skips over. */
export const loaderUpdateSchema = loaderReleaseSchema.extend({
	/** Each version newer than the installed one, up to and including `version`, newest first. */
	changelogs: z.array(versionChangelogSchema).max(MAX_UPDATE_CHANGELOGS),
});

/** `update` is `null` when the installed loader is the newest release it may move to. */
export const loaderUpdateResponseSchema = z.object({
	update: loaderUpdateSchema.nullable(),
});

export type LoaderPlatform = z.infer<typeof loaderPlatformSchema>;
export type LoaderRelease = z.infer<typeof loaderReleaseSchema>;
export type PublishLoaderReleaseRequest = z.infer<typeof publishLoaderReleaseRequestSchema>;
export type LoaderUpdateQuery = z.infer<typeof loaderUpdateQuerySchema>;
export type LoaderUpdate = z.infer<typeof loaderUpdateSchema>;
export type LoaderUpdateResponse = z.infer<typeof loaderUpdateResponseSchema>;

export default {
	loaderPlatformSchema,
	loaderReleaseSchema,
	publishLoaderReleaseRequestSchema,
	loaderUpdateQuerySchema,
	loaderUpdateSchema,
	loaderUpdateResponseSchema,
};

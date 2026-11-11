import { Type, type StaticDecode } from './schema';

/** How many builds `GET /api/v1/loader/android-builds` returns per channel, newest first. */
export const MAX_ANDROID_BUILDS = 50;

/** The versionCode every patched Discord carries, so Android installs any build over any other. */
export const PATCHED_ANDROID_VERSION_CODE = 2_000_000_000;

/** The Google Play channel a patched Discord build was made from. */
export const androidChannelSchema = Type.Enum(['stable', 'beta', 'alpha']);

const sha256Schema = Type.String({
	pattern: '^[\\da-f]{64}$',
	errorMessage: 'Must be a lowercase SHA-256 digest.',
});

/** A split's name as Android reports it: `base`, or a config split such as `config.arm64_v8a`. */
export const androidSplitNameSchema = Type.String({
	pattern: '^(base|config\\.[a-z\\d_]{1,32})$',
	errorMessage: 'Must be "base" or a config split such as "config.arm64_v8a".',
});

const androidSplitProperties = {
	name: androidSplitNameSchema,
	/** SHA-256 of the APK itself, after the download is gunzipped. */
	sha256: sha256Schema,
	/** Size of the APK in bytes. */
	size: Type.Integer({ minimum: 1 }),
	/** Size of the gzip download in bytes. */
	compressedSize: Type.Integer({ minimum: 1 }),
};

/** One gzipped split APK of a build, as a client downloads it. */
export const androidBuildSplitSchema = Type.Object({
	...androidSplitProperties,
	url: Type.String({ format: 'url', pattern: /^https?:\/\//i }),
});

const androidBuildProperties = {
	channel: androidChannelSchema,
	/** Discord's version name without the channel suffix, such as `352.17`. */
	discordVersion: Type.String({ pattern: '^\\d{1,4}\\.\\d{1,4}$' }),
	/** Discord's own versionCode, before patching pinned it. */
	discordVersionCode: Type.Integer({ minimum: 1, maximum: PATCHED_ANDROID_VERSION_CODE - 1 }),
	/** The repository commit the loader in this build was built from. */
	commit: Type.String({ pattern: '^[\\da-f]{40}$' }),
};

/** A patched Discord build with Unbound's loader, installable in place over any other. */
export const androidBuildSchema = Type.Object({
	...androidBuildProperties,
	splits: Type.Array(androidBuildSplitSchema, { minItems: 1, maxItems: 64 }),
	publishedAt: Type.String({ format: 'date-time' }),
});

/** What CI posts once a build's splits are in the public bucket; each split names its bucket `key`. Posting a build again replaces its splits. */
export const publishAndroidBuildRequestSchema = Type.Object({
	...androidBuildProperties,
	splits: Type.Array(
		Type.Object({
			...androidSplitProperties,
			key: Type.String({ pattern: '^android/[\\w.\\-/]{1,200}\\.apk\\.gz$' }),
		}),
		{ minItems: 1, maxItems: 64 },
	),
});

/** The channel `GET /api/v1/loader/android-builds` lists. */
export const androidBuildsQuerySchema = Type.Object({
	channel: androidChannelSchema,
});

/** A channel's builds, newest Discord first, then newest loader. */
export const androidBuildsResponseSchema = Type.Object({
	builds: Type.Array(androidBuildSchema, { maxItems: MAX_ANDROID_BUILDS }),
});

export type AndroidChannel = StaticDecode<typeof androidChannelSchema>;
export type AndroidBuild = StaticDecode<typeof androidBuildSchema>;
export type PublishAndroidBuildRequest = StaticDecode<typeof publishAndroidBuildRequestSchema>;
export type AndroidBuildsQuery = StaticDecode<typeof androidBuildsQuerySchema>;
export type AndroidBuildsResponse = StaticDecode<typeof androidBuildsResponseSchema>;

export default {
	androidChannelSchema,
	androidSplitNameSchema,
	androidBuildSplitSchema,
	androidBuildSchema,
	publishAndroidBuildRequestSchema,
	androidBuildsQuerySchema,
	androidBuildsResponseSchema,
};

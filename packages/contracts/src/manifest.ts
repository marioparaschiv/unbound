import {
	NATIVE_PLUGIN_CAPABILITIES,
	NATIVE_PLUGIN_PLATFORM_CAPABILITIES,
	NATIVE_PLUGIN_PLATFORMS,
} from '@unbound-app/types/native';
import { ADDON_KINDS } from '@unbound-app/types/addons';

import {
	ADDON_ID_MAX_LENGTH,
	ADDON_ID_PATTERN,
	ADDON_MAIN_PATTERN,
	SEMVER_PATTERN,
} from './manifest-patterns';
import { DEVELOPMENT_MARKER, MANIFEST_FILENAME } from './manifest-files';
import { Type, type StaticDecode } from './schema';

export {
	ADDON_ID_MAX_LENGTH,
	ADDON_ID_PATTERN,
	ADDON_MAIN_PATTERN,
	isAddonId,
	isAddonMain,
	isSemver,
	SEMVER_PATTERN,
} from './manifest-patterns';
export { DEVELOPMENT_MARKER, MANIFEST_FILENAME } from './manifest-files';

export const semverSchema = Type.String({
	maxLength: 64,
	pattern: `^${SEMVER_PATTERN}$`,
	errorMessage: 'Must be a semver version.',
});

/**
 * Addon ids become object-storage path segments (`addons/{id}/{version}/...`), so they are limited to
 * path-safe characters: alphanumeric runs joined by single `.`, `_` or `-`.
 */
export const addonIdSchema = Type.String({
	maxLength: ADDON_ID_MAX_LENGTH,
	pattern: ADDON_ID_PATTERN,
	errorMessage: 'Must be alphanumeric segments joined by ".", "_" or "-".',
});

// The bundle is published next to the manifest at `addons/{id}/{version}/{main}` and resolved
// relative to the manifest URL, so `main` may not leave that directory.
export const addonMainSchema = Type.String({
	pattern: ADDON_MAIN_PATTERN,
	errorMessage: 'Must be a relative path inside the addon.',
});

/** Maps each Hermes bytecode version an addon ships to the SHA-512 of that compiled bundle. */
export const bytecodeDigestsSchema = Type.Record(
	Type.String({ pattern: '^\\d{1,10}$', errorMessage: 'Must be a Hermes bytecode version.' }),
	Type.String({
		pattern: '^[\\da-f]{128}$',
		errorMessage: 'Must be a lowercase SHA-512 digest.',
	}),
	{ additionalProperties: false },
);

export const addonPlatformsSchema = Type.Refine(
	Type.Object(
		{
			ios: Type.Optional(
				Type.Object(
					{
						capabilities: Type.Optional(
							Type.Array(Type.Enum(NATIVE_PLUGIN_PLATFORM_CAPABILITIES.ios)),
						),
					},
					{ additionalProperties: false },
				),
			),
			android: Type.Optional(
				Type.Object(
					{
						capabilities: Type.Optional(
							Type.Array(Type.Enum(NATIVE_PLUGIN_PLATFORM_CAPABILITIES.android)),
						),
					},
					{ additionalProperties: false },
				),
			),
		},
		{ additionalProperties: false },
	),
	(platforms) => Object.keys(platforms).length > 0,
	() => 'Must list a platform.',
);

const legacyPlatformListSchema = Type.Array(Type.Enum(NATIVE_PLUGIN_PLATFORMS), { minItems: 1 });

export const addonAuthorSchema = Type.Object({
	name: Type.String({ minLength: 1 }),
	// A string of digits, typed as the template literal Discord user ids use.
	id: Type.Unsafe<`${number}`>(Type.String({ pattern: '^\\d+$' })),
});

/**
 * The manifest an author publishes. Unknown keys pass through untouched, so the stored manifest is
 * what the author shipped; only the fields the platform relies on are validated.
 */
export const addonManifestSchema = Type.Object(
	{
		id: addonIdSchema,
		type: Type.Optional(Type.Enum(ADDON_KINDS)),
		name: Type.String({ minLength: 1 }),
		description: Type.String(),
		authors: Type.Array(addonAuthorSchema, { minItems: 1 }),
		icon: Type.Optional(Type.Union([Type.String(), Type.Object({ uri: Type.String() })])),
		main: addonMainSchema,
		version: semverSchema,
		/** The platforms the addon runs on, each with its capabilities; absent means every platform. */
		platforms: Type.Optional(Type.Union([addonPlatformsSchema, legacyPlatformListSchema])),
		capabilities: Type.Optional(Type.Array(Type.Enum(NATIVE_PLUGIN_CAPABILITIES))),
		/** @deprecated Use `platforms.<platform>.capabilities`. Still accepted for published addons. */
		platformCapabilities: Type.Optional(
			Type.Partial(
				Type.Record(
					Type.Enum(NATIVE_PLUGIN_PLATFORMS),
					Type.Array(Type.Enum(NATIVE_PLUGIN_CAPABILITIES)),
				),
				{ additionalProperties: false },
			),
		),
		minNativePluginApi: Type.Optional(Type.String()),
		unbound: Type.Optional(Type.Object({ min: Type.Optional(semverSchema) })),
		bytecode: Type.Optional(bytecodeDigestsSchema),
		/** Marks a plugin other plugins build on, which the plugin list hides by default. */
		library: Type.Optional(Type.Boolean()),
		/** The addons this one needs, by id, each with the semver range it accepts. */
		dependencies: Type.Optional(
			Type.Record(addonIdSchema, Type.String({ minLength: 1 }), {
				additionalProperties: false,
			}),
		),
	},
	{ additionalProperties: true },
);

export type PublishedManifest = StaticDecode<typeof addonManifestSchema>;

export default {
	MANIFEST_FILENAME,
	DEVELOPMENT_MARKER,
	semverSchema,
	addonIdSchema,
	addonMainSchema,
	bytecodeDigestsSchema,
	addonPlatformsSchema,
	addonAuthorSchema,
	addonManifestSchema,
};

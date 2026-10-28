import { NATIVE_PLUGIN_CAPABILITIES } from '@unbound-app/types/native';
import { ADDON_TYPES } from '@unbound-app/types/addons';

import { z } from './zod';

/**
 * A strict SemVer 2.0.0 version (the specification's own pattern): no `v` prefix, no leading zeros.
 * Versions become object-storage path segments and are ordered by the server, so loose forms are refused.
 */
export const semverSchema = z
	.string()
	.check(
		z.maxLength(64),
		z.regex(
			/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
			'Must be a semver version.',
		),
	);

/**
 * Addon ids become object-storage path segments (`addons/{id}/{version}/...`), so they are limited to
 * path-safe characters: alphanumeric runs joined by single `.`, `_` or `-`.
 */
export const addonIdSchema = z
	.string()
	.check(
		z.maxLength(100),
		z.regex(
			/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/,
			'Must be alphanumeric segments joined by ".", "_" or "-".',
		),
	);

// The bundle is published next to the manifest at `addons/{id}/{version}/{main}` and resolved
// relative to the manifest URL, so `main` may not leave that directory.
export const addonMainSchema = z
	.string()
	.check(
		z.regex(/^(?:[\w-][\w.-]*\/)*[\w-][\w.-]*$/, 'Must be a relative path inside the addon.'),
	);

/** Maps each Hermes bytecode version an addon ships to the SHA-512 of that compiled bundle. */
export const bytecodeDigestsSchema = z.record(
	z.string().check(z.regex(/^\d{1,10}$/, 'Must be a Hermes bytecode version.')),
	z.string().check(z.regex(/^[\da-f]{128}$/, 'Must be a lowercase SHA-512 digest.')),
);

export const addonAuthorSchema = z.object({
	name: z.string().check(z.minLength(1)),
	id: z.templateLiteral([z.int().check(z.nonnegative())]),
});

/**
 * The manifest an author publishes. Unknown keys pass through untouched, so the stored manifest is
 * what the author shipped; only the fields the platform relies on are validated.
 */
export const addonManifestSchema = z.looseObject({
	id: addonIdSchema,
	type: z.optional(z.enum(ADDON_TYPES)),
	name: z.string().check(z.minLength(1)),
	description: z.string(),
	authors: z.array(addonAuthorSchema).check(z.minLength(1)),
	icon: z.optional(z.union([z.string(), z.object({ uri: z.string() })])),
	main: addonMainSchema,
	version: semverSchema,
	capabilities: z.optional(z.array(z.enum(NATIVE_PLUGIN_CAPABILITIES))),
	minNativePluginApi: z.optional(z.string()),
	unbound: z.optional(z.object({ min: z.optional(semverSchema) })),
	bytecode: z.optional(bytecodeDigestsSchema),
});

export type PublishedManifest = z.infer<typeof addonManifestSchema>;

export default {
	semverSchema,
	addonIdSchema,
	addonMainSchema,
	bytecodeDigestsSchema,
	addonAuthorSchema,
	addonManifestSchema,
};

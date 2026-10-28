import { addonIdSchema, semverSchema } from './manifest';
import { addonVersionSchema } from './addons';
import { z } from './zod';

export const installedAddonSchema = z.object({
	id: addonIdSchema,
	version: semverSchema,
	/** The SHA-256 of the installed bundle, so a version rebuilt in place is offered again. */
	sha256: z.optional(z.string().check(z.regex(/^[\da-f]{64}$/))),
});

export const updatesRequestSchema = z.object({
	clientVersion: semverSchema,
	addons: z.array(installedAddonSchema).check(
		z.maxLength(500),
		z.refine(
			(addons) => new Set(addons.map((addon) => addon.id)).size === addons.length,
			'Addon ids must be unique.',
		),
	),
});

/** The release a manager installs: where to fetch it and the bundle digest to verify. */
export const addonReleaseSchema = z.extend(
	z.pick(addonVersionSchema, {
		version: true,
		manifestUrl: true,
		bundleUrl: true,
		sha256: true,
		changelog: true,
		changes: true,
	}),
	{ id: addonIdSchema },
);

/** The most changelogs one update lists. */
export const MAX_UPDATE_CHANGELOGS = 20;

export const versionChangelogSchema = z.pick(addonVersionSchema, {
	version: true,
	changelog: true,
	changes: true,
	publishedAt: true,
});

/** The newest compatible release, with `changelogs` covering every version it skips over. */
export const addonUpdateSchema = z.extend(addonReleaseSchema, {
	/** Each version newer than the installed one, up to and including `version`, newest first. */
	changelogs: z._default(
		z.array(versionChangelogSchema).check(z.maxLength(MAX_UPDATE_CHANGELOGS)),
		[],
	),
});

/** Only addons with a newer approved version compatible with `clientVersion` are listed. */
export const updatesResponseSchema = z.object({
	updates: z.array(addonUpdateSchema),
});

export type InstalledAddon = z.infer<typeof installedAddonSchema>;
export type UpdatesRequest = z.infer<typeof updatesRequestSchema>;
export type AddonRelease = z.infer<typeof addonReleaseSchema>;
export type VersionChangelog = z.infer<typeof versionChangelogSchema>;
export type AddonUpdate = z.infer<typeof addonUpdateSchema>;
export type UpdatesResponse = z.infer<typeof updatesResponseSchema>;

export default {
	MAX_UPDATE_CHANGELOGS,
	installedAddonSchema,
	updatesRequestSchema,
	addonReleaseSchema,
	versionChangelogSchema,
	addonUpdateSchema,
	updatesResponseSchema,
};

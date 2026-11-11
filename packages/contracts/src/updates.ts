import { addonIdSchema, semverSchema } from './manifest';
import { Type, type StaticDecode } from './schema';
import { addonVersionSchema } from './addons';

export const installedAddonSchema = Type.Object({
	id: addonIdSchema,
	version: semverSchema,
	/** The SHA-256 of the installed bundle, so a version rebuilt in place is offered again. */
	sha256: Type.Optional(Type.String({ pattern: /^[\da-f]{64}$/ })),
});

export const updatesRequestSchema = Type.Object({
	clientVersion: semverSchema,
	addons: Type.Refine(
		Type.Array(installedAddonSchema, { maxItems: 500 }),
		(addons) => new Set(addons.map((addon) => addon.id)).size === addons.length,
		() => 'Addon ids must be unique.',
	),
});

/** The release a manager installs: where to fetch it and the bundle digest to verify. */
export const addonReleaseSchema = Type.Object({
	...Type.Pick(addonVersionSchema, [
		'version',
		'manifestUrl',
		'bundleUrl',
		'sha256',
		'changelog',
		'changes',
	]).properties,
	id: addonIdSchema,
});

/** The most changelogs one update lists. */
export const MAX_UPDATE_CHANGELOGS = 20;

export const versionChangelogSchema = Type.Pick(addonVersionSchema, [
	'version',
	'changelog',
	'changes',
	'publishedAt',
]);

/** Why an update is offered: a newer version, a withdrawn install to roll back, or the same version rebuilt. */
export const UPDATE_REASONS = ['newer', 'withdrawn', 'rebuilt'] as const;

export const updateReasonSchema = Type.Enum(UPDATE_REASONS);

/** The newest compatible release, with `changelogs` covering every version it skips over. */
export const addonUpdateSchema = Type.Object({
	...addonReleaseSchema.properties,
	reason: updateReasonSchema,
	/** Each version newer than the installed one, up to and including `version`, newest first. */
	changelogs: Type.Array(versionChangelogSchema, {
		maxItems: MAX_UPDATE_CHANGELOGS,
		default: [],
	}),
});

/** Only addons with a newer approved version compatible with `clientVersion` are listed. */
export const updatesResponseSchema = Type.Object({
	updates: Type.Array(addonUpdateSchema),
});

export type UpdatesRequest = StaticDecode<typeof updatesRequestSchema>;
export type AddonRelease = StaticDecode<typeof addonReleaseSchema>;
export type VersionChangelog = StaticDecode<typeof versionChangelogSchema>;
export type UpdateReason = StaticDecode<typeof updateReasonSchema>;
export type AddonUpdate = StaticDecode<typeof addonUpdateSchema>;
export type UpdatesResponse = StaticDecode<typeof updatesResponseSchema>;

export default {
	MAX_UPDATE_CHANGELOGS,
	installedAddonSchema,
	updatesRequestSchema,
	addonReleaseSchema,
	versionChangelogSchema,
	updateReasonSchema,
	addonUpdateSchema,
	updatesResponseSchema,
};

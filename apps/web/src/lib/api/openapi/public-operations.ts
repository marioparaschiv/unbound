import type { Api } from '~/api';

/** The HTTP reference's sections, in the order the docs and the OpenAPI document list them. */
export const OPERATION_TAGS = [
	{ name: 'Addons', description: 'Read the addon store: listings, versions and maintainers.' },
	{ name: 'Updates', description: 'Check installed addons and the native loader for updates.' },
	{ name: 'Users', description: 'Read what a user shows on their profile.' },
] as const;

export type OperationTag = (typeof OPERATION_TAGS)[number]['name'];

/** How the HTTP reference and the OpenAPI document describe one public operation. */
export type PublicOperation = {
	tag: OperationTag;
	summary: string;
	description: string;
	/** A description of each path segment and query parameter, by name. */
	parameters?: Record<string, string>;
};

/** A served operation's key in the API map, such as `GET /api/v1/catalog`. */
export type PublicOperationKey = keyof Api;

const ADDON_ID = 'The addon id, such as `unbound.example`.';

/**
 * The `/api/v1` operations third parties may call without signing in, opted in one by one. An
 * operation absent here is never documented, even when anyone can call it.
 */
export const PUBLIC_OPERATIONS = {
	'GET /api/v1/catalog': {
		tag: 'Addons',
		summary: 'Get the catalog',
		description:
			'Every listed addon with its newest version. Send `revision` in `If-None-Match` to get `304` while nothing changed.',
	},
	'GET /api/v1/addons': {
		tag: 'Addons',
		summary: 'List addons',
		description: 'A filtered, sorted page of listed addons with their newest versions.',
		parameters: {
			type: 'Only addons of this type.',
			q: 'Search text, matched in the name or description.',
			sort: 'Defaults to `name`. Ties sort by id.',
			order: 'Defaults to `asc`.',
			tags: 'Comma-separated tag ids, combined by `tagMatch`.',
			tagMatch: 'Defaults to `any`.',
			authors: 'Comma-separated Discord ids of credited authors.',
			authorMatch: 'Defaults to `any`. `none` excludes these authors.',
			updated: 'Days since the newest version was approved.',
			updatedMatch: 'Defaults to `any`, within `updated` days. `none` means older.',
			cursor: "The previous page's `nextCursor`. Keep the same filters.",
		},
	},
	'GET /api/v1/addons/$id/versions': {
		tag: 'Addons',
		summary: "List an addon's versions",
		description: "A listed addon's live versions, newest first.",
		parameters: { id: ADDON_ID },
	},
	'GET /api/v1/addons/$id/maintainers': {
		tag: 'Addons',
		summary: "List an addon's maintainers",
		description: "An addon's maintainers with their roles.",
		parameters: { id: ADDON_ID },
	},
	'POST /api/v1/updates': {
		tag: 'Updates',
		summary: 'Check addons for updates',
		description:
			'The installed addons that have a newer, withdrawn or rebuilt version. Rate limited per IP.',
	},
	'GET /api/v1/loader/updates': {
		tag: 'Updates',
		summary: 'Check for loader updates',
		description: 'The newest loader release, or `null` when current. Rate limited per IP.',
		parameters: {
			platform: 'The platform the loader runs on.',
			version: 'The installed loader version.',
		},
	},
	'GET /api/v1/loader/android-builds': {
		tag: 'Updates',
		summary: 'List patched Android Discord builds',
		description:
			"A channel's patched Discord builds with each gzipped split's URL, newest Discord first. Rate limited per IP.",
		parameters: {
			channel: 'The Google Play channel the builds were made from.',
		},
	},
	'GET /api/v1/users/$id/badges': {
		tag: 'Users',
		summary: "List a user's badges",
		description: 'The sponsor badges a user shows on their profile, in order.',
		parameters: {
			id: "The user's id, as the maintainers list returns it, or the Discord id of their linked Discord account.",
		},
	},
} satisfies Partial<Record<PublicOperationKey, PublicOperation>>;

export default { OPERATION_TAGS, PUBLIC_OPERATIONS };

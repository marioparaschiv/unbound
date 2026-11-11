import type { AddonUpdate, UpdatesRequest, UpdatesResponse } from '@unbound-app/contracts/updates';
import { isAddonId, isSemver } from '@unbound-app/contracts/manifest-patterns';
import type { Plugin } from '@unbound-app/types';

import type { UpdatableKind } from '~/addons/manager-of';
import { createUnboundClient } from '~/account/client';
import { CLIENT_VERSION } from '~/core/constants';
import type { Addons } from '~/addons/addons';

/** The part of an addon manager the updater drives. */
export type UpdatableManager = Pick<
	Addons<Plugin>,
	'listInstalled' | 'update' | 'getHeldVersion' | 'clearDevelopmentCopy'
>;

/**
 * The one route of the Unbound API client the updater asks. Narrower than `ApiRequest`, so the addon
 * types the SDK bundles from this module never pull in the web routes.
 */
export type UpdatesClient = (
	route: 'POST /api/v1/updates',
	init: UpdatesClientInit,
) => Promise<UpdatesResponse>;

type UpdatesClientInit = { body: UpdatesRequest };

export type UpdateCheckOptions = {
	/** The Unbound API client to ask. */
	request?: UpdatesClient;
	/** The client version the server checks each update's minimum against. */
	clientVersion?: string;
};

/** An installed addon as its manager reports it, before its id and version are validated. */
export type InstalledEntry = {
	kind: UpdatableKind;
	id: string;
	name: string;
	version: string;
	/** The installed bundle's SHA-256, so a version rebuilt in place is offered again. */
	sha256?: string;
};

/** An update waiting to be applied: the installed addon and the release it moves to. */
export type PendingUpdate = {
	kind: UpdatableKind;
	id: string;
	name: string;
	/** The installed version. */
	from: string;
	update: AddonUpdate;
};

// Locally built addons may not carry a marketplace id or a semver version; the first manager to
// list an id owns it.
function checkable(entries: InstalledEntry[]): Map<string, InstalledEntry> {
	const owners = new Map<string, InstalledEntry>();

	for (const entry of entries) {
		if (owners.has(entry.id) || !isAddonId(entry.id) || !isSemver(entry.version)) {
			continue;
		}

		owners.set(entry.id, entry);
	}

	return owners;
}

/**
 * @description Builds the body of `POST /api/v1/updates` from every installed addon.
 * @param entries The installed addons across the updatable managers.
 * @param clientVersion This client's version.
 * @returns The request, or `undefined` when no addon can be checked.
 */
export function buildUpdatesRequest(
	entries: InstalledEntry[],
	clientVersion: string,
): UpdatesRequest | undefined {
	const addons = [...checkable(entries).values()].map(({ id, version, sha256 }) =>
		sha256 ? { id, version, sha256 } : { id, version },
	);

	if (!addons.length) return;

	return { clientVersion, addons };
}

/**
 * @description Fills the fields a server older than the contract omits, which the contract declares
 * `default`s for: why the update is offered, and the changelogs it skips over.
 * @param update The update as the server sent it.
 * @returns The update with both fields present.
 */
function readUpdate(update: AddonUpdate): AddonUpdate {
	return Object.assign({ reason: 'newer', changelogs: [] }, update);
}

/**
 * @description Pairs each returned update with the installed addon it applies to, sorted by name.
 * @param entries The installed addons the request was built from.
 * @param response The server's answer.
 * @returns The pending updates; updates for addons no longer installed are dropped.
 */
export function toPendingUpdates(
	entries: InstalledEntry[],
	response: UpdatesResponse,
): PendingUpdate[] {
	const owners = checkable(entries);

	return response.updates
		.flatMap((update) => {
			const entry = owners.get(update.id);

			return entry
				? [
						{
							kind: entry.kind,
							id: entry.id,
							name: entry.name,
							from: entry.version,
							update: readUpdate(update),
						},
					]
				: [];
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @description Asks `POST /api/v1/updates` which installed addons have updates, in one request.
 * Addons the server doesn't know are never listed back.
 * @param entries The installed addons across the updatable managers.
 * @param options The API client and this client's version, both defaulting to this client's.
 * @returns The pending updates; rejects when the server can't be reached or answers with an error.
 */
export async function fetchUpdates(
	entries: InstalledEntry[],
	{ request = createUnboundClient(), clientVersion = CLIENT_VERSION }: UpdateCheckOptions = {},
): Promise<PendingUpdate[]> {
	const body = buildUpdatesRequest(entries, clientVersion);

	if (!body) {
		return [];
	}

	const response = await request('POST /api/v1/updates', {
		body,
	});

	return toPendingUpdates(entries, response);
}

/**
 * @description Whether the updater applies an update on its own. A held addon only takes the ones that
 * replace a withdrawn or rebuilt install, never a newer version.
 * @param update The update the server offered.
 * @param held Whether the user holds the addon at its installed version.
 * @returns Whether to apply it without asking.
 */
export function autoApplies(update: AddonUpdate, held: boolean): boolean {
	return !held || update.reason !== 'newer';
}

/**
 * @description Picks the pending updates the updater applies on its own, reading each hold now.
 * @param updates The pending updates.
 * @param managerOf Returns the manager of an addon kind.
 * @returns The updates `autoApplies` lets through.
 */
export function automaticUpdates(
	updates: PendingUpdate[],
	managerOf: (kind: UpdatableKind) => UpdatableManager,
): PendingUpdate[] {
	return updates.filter((entry) =>
		autoApplies(entry.update, managerOf(entry.kind).getHeldVersion(entry.id) !== void 0),
	);
}

/**
 * @description Replaces a development copy with the store's published build: clears its development mark, then checks just that addon and applies the update the store returns.
 * @param manager The manager the addon belongs to.
 * @param id The addon's id.
 * @param options The API client and this client's version, both defaulting to this client's.
 * @returns Whether the store's build was applied; `false` when the installed bundle already matches the store or the store does not publish it.
 */
export async function reinstallFromStore(
	manager: UpdatableManager,
	id: string,
	options: UpdateCheckOptions = {},
): Promise<boolean> {
	manager.clearDevelopmentCopy(id);

	const entries = manager.listInstalled().filter((entry) => entry.id === id);
	const [pending] = await fetchUpdates(entries, options);

	return pending ? manager.update(pending.id, pending.update) : false;
}

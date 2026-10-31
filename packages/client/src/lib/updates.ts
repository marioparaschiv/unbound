import {
	installedAddonSchema,
	updatesRequestSchema,
	updatesResponseSchema,
} from '@unbound-app/contracts/updates';
import type { AddonUpdate, UpdatesRequest, UpdatesResponse } from '@unbound-app/contracts/updates';
import { createApiClient } from '@unbound-app/web/client';
import type { Plugin } from '@unbound-app/types';
import type { Api } from '@unbound-app/web/api';

import type { UpdatableKind } from '~/managers/manager-of';
import type { Addons } from '~/managers/addons';

/** The part of an addon manager the updater drives. */
export type UpdatableManager = Pick<
	Addons<Plugin>,
	'listInstalled' | 'applyRelease' | 'getHeldVersion' | 'clearDevelopmentCopy'
>;

export type UpdateCheckOptions = {
	/** Origin of the Unbound web API. */
	baseUrl: string;
	clientVersion: string;
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
		if (owners.has(entry.id) || !installedAddonSchema.safeParse(entry).success) {
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

	return updatesRequestSchema.parse({ clientVersion, addons });
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
							update,
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
 * @param options The API origin and this client's version.
 * @returns The pending updates; rejects when the server can't be reached or answers with an error.
 */
export async function fetchUpdates(
	entries: InstalledEntry[],
	options: UpdateCheckOptions,
): Promise<PendingUpdate[]> {
	const body = buildUpdatesRequest(entries, options.clientVersion);

	if (!body) {
		return [];
	}

	const request = createApiClient<Api>({ baseUrl: options.baseUrl });
	const response = await request('POST /api/v1/updates', {
		body,
		response: updatesResponseSchema,
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
 * @param options The API origin and this client's version.
 * @returns Whether the store's build was applied; `false` when the installed bundle already matches the store or the store does not publish it.
 */
export async function reinstallFromStore(
	manager: UpdatableManager,
	id: string,
	options: UpdateCheckOptions,
): Promise<boolean> {
	manager.clearDevelopmentCopy(id);

	const entries = manager.listInstalled().filter((entry) => entry.id === id);
	const [pending] = await fetchUpdates(entries, options);

	return pending ? manager.applyRelease(pending.id, pending.update) : false;
}

export default {
	buildUpdatesRequest,
	toPendingUpdates,
	fetchUpdates,
	autoApplies,
	automaticUpdates,
	reinstallFromStore,
};

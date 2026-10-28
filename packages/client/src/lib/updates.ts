import {
	installedAddonSchema,
	updatesRequestSchema,
	updatesResponseSchema,
} from '@unbound-app/contracts/updates';
import type { AddonUpdate, UpdatesRequest, UpdatesResponse } from '@unbound-app/contracts/updates';
import { createApiClient } from '@unbound-app/web/client';
import type { Addon } from '@unbound-app/types';
import type { Api } from '@unbound-app/web/api';
import sha256 from '@unbound-app/utils/sha256';

import type { ManagerKind } from '~/lib/constants';
import type { Addons } from '~/managers/addons';

/** Managers whose addons carry a marketplace id and version; fonts have neither. */
export type UpdatableKind = Exclude<ManagerKind, ManagerKind.Fonts>;

/** The part of an addon manager the updater drives; each manager narrows the entity type. */
export type UpdatableManager = Pick<Addons<Addon>, 'getEntities' | 'getEntity' | 'update'> &
	Partial<Pick<Addons<Addon>, 'isDevelopmentCopy' | 'clearDevelopmentCopy'>>;

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

type BundleDigest = {
	bundle: string;
	digest: string;
};

const bundleDigests = new Map<string, BundleDigest>();

function digestOf(id: string, bundle: string): string {
	const cached = bundleDigests.get(id);

	if (cached?.bundle === bundle) {
		return cached.digest;
	}

	const digest = sha256(bundle);

	bundleDigests.set(id, { bundle, digest });

	return digest;
}

/**
 *
 */
/**
 * @description Lists a manager's installed addons for an update check.
 * @param kind The manager's kind, carried onto each entry.
 * @param manager The manager.
 * @returns One entry per installed addon.
 */
export function listInstalled(kind: UpdatableKind, manager: UpdatableManager): InstalledEntry[] {
	return manager
		.getEntities()
		.filter((entity) => !manager.isDevelopmentCopy?.(entity.id))
		.map((entity) => ({
			kind,
			id: entity.id,
			name: entity.data.name,
			version: entity.data.version,
			...(typeof entity.bundle === 'string' && entity.bundle
				? { sha256: digestOf(entity.id, entity.bundle) }
				: {}),
		}));
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
 * @description Has the owning manager apply a pending update.
 * @param manager The manager the addon belongs to.
 * @param pending The update.
 * @returns Whether the addon now runs the new version; the manager records why when it doesn't.
 */
export async function applyUpdate(
	manager: UpdatableManager,
	pending: PendingUpdate,
): Promise<boolean> {
	await manager.update(pending.id, pending.update);

	return manager.getEntity(pending.id)?.data.version === pending.update.version;
}

/**
 * @description Replaces a development copy with the store's published build: clears its development mark, then checks just that addon and applies the update the store returns.
 * @param kind The manager's kind.
 * @param manager The manager the addon belongs to.
 * @param id The addon's id.
 * @param options The API origin and this client's version.
 * @returns Whether the store's build was applied; `false` when the installed bundle already matches the store or the store does not publish it.
 */
export async function reinstallFromStore(
	kind: UpdatableKind,
	manager: UpdatableManager,
	id: string,
	options: UpdateCheckOptions,
): Promise<boolean> {
	manager.clearDevelopmentCopy?.(id);

	const entries = listInstalled(kind, manager).filter((entry) => entry.id === id);
	const [pending] = await fetchUpdates(entries, options);

	return pending ? applyUpdate(manager, pending) : false;
}

export default {
	buildUpdatesRequest,
	toPendingUpdates,
	listInstalled,
	fetchUpdates,
	applyUpdate,
	reinstallFromStore,
};

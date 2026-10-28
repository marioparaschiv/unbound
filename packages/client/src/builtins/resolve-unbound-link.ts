import type { AddonType, ListedAddon } from '@unbound-app/contracts/addons';
import type { UnboundLink } from '@unbound-app/contracts/links';

import type { MarketplaceState } from '~/lib/catalog';
import type { ManagerKind } from '~/lib/constants';
import { getInstallStatus } from '~/lib/catalog';

export type LinkTargets = {
	/** Reads the stored catalog once, then refreshes it. */
	load: () => Promise<boolean>;
	refresh: () => Promise<boolean>;
	state: () => MarketplaceState;
	kindOf: (type: AddonType) => ManagerKind | undefined;
	installedVersion: (kind: ManagerKind, addon: ListedAddon) => string | undefined;
	/** Opens the Marketplace focused on an addon, which asks for confirmation there. */
	open: (kind: ManagerKind, id: string) => Promise<void>;
};

/** How a link ended: no catalog to look in, not listed, nothing to do, or handed to the Marketplace. */
export type LinkOutcome =
	| { type: 'offline'; id: string }
	| { type: 'missing'; id: string }
	| { type: 'current'; addon: ListedAddon }
	| { type: 'opened'; addon: ListedAddon; kind: ManagerKind };

function find(targets: LinkTargets, id: string): ListedAddon | undefined {
	const state = targets.state();

	return state.status === 'ready'
		? state.catalog.addons.find((addon) => addon.id === id)
		: void 0;
}

async function findOrRefresh(targets: LinkTargets, id: string): Promise<ListedAddon | undefined> {
	const addon = find(targets, id);

	if (addon) {
		return addon;
	}

	await targets.refresh();

	return find(targets, id);
}

/**
 * @description Looks a link's addon up in the catalog and opens the Marketplace on it unless it is already current.
 * @param link The parsed link.
 * @param targets The catalog, managers and navigation to act on.
 * @returns What happened, for the caller to report.
 */
async function resolveUnboundLink(link: UnboundLink, targets: LinkTargets): Promise<LinkOutcome> {
	const { id } = link;

	await targets.load();

	const addon = await findOrRefresh(targets, id);

	if (targets.state().status !== 'ready') {
		return { type: 'offline', id };
	}

	const kind = addon ? targets.kindOf(addon.type) : void 0;

	if (!addon || kind === undefined) {
		return { type: 'missing', id };
	}

	const installed = targets.installedVersion(kind, addon);

	if (getInstallStatus(addon.latestVersion.version, installed) === 'installed') {
		return { type: 'current', addon };
	}

	await targets.open(kind, id);

	return { type: 'opened', addon, kind };
}

export default resolveUnboundLink;

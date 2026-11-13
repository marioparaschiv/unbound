import type { AddonRename } from '@unbound-app/contracts/updates';
import { ADDON_KINDS } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';

import { installsFromManifest } from '~/addons/installs-from-manifest';
import { getBucket, snapshot } from '~/storage/api';
import { Manager } from '~/addons/manager';
import { format } from '~/i18n/api';
import { show } from '~/toasts/api';

const logger = createLogger('Addons', 'Renames');

type RenameOptions = {
	install: (id: string) => Promise<boolean>;
};

function managerHolding(id: string) {
	return ADDON_KINDS.filter(installsFromManifest)
		.map((kind) => Manager.for(kind))
		.find((manager) => manager.getAddon(id));
}

function moveSettings(from: string, to: string): void {
	const stores = snapshot({ includeSecrets: true });
	const previous = stores[from];

	if (!previous || stores[to]) return;

	const bucket = getBucket(to);

	for (const [key, value] of Object.entries(previous)) bucket.set(key, value);
}

/**
 * @description Moves an install from an addon's old id to the addon that replaces it: installs the new one, carries over its
 * settings Bucket and whether it was on, then removes the old one. Leaves the old addon alone when the new one cannot install.
 * @param rename The installed id and the addon that replaces it.
 * @param options `install` installs the new addon from the marketplace by id.
 * @returns Whether the old addon is gone and the new one is in place.
 */
export async function moveRenamedAddon(
	{ from, to }: AddonRename,
	{ install }: RenameOptions,
): Promise<boolean> {
	const manager = managerHolding(from);

	if (!manager) {
		return false;
	}

	const previous = manager.getAddon(from);
	const wasEnabled = manager.isEnabled(from);

	moveSettings(from, to);

	if (!manager.getAddon(to) && !(await install(to))) {
		logger.warn(`Failed to install ${to}, which replaces ${from}; keeping ${from}.`);

		return false;
	}

	if (wasEnabled && !manager.isEnabled(to)) {
		await manager.enable(to);
	} else if (!wasEnabled && manager.isEnabled(to)) {
		manager.disable(to);
	}

	await manager.uninstall(from);
	getBucket(from).clear();

	const name = manager.getAddon(to)?.manifest.name ?? to;

	show({
		title: name,
		content: format('UNBOUND_ADDON_RENAMED_TOAST', {
			from: previous?.manifest.name ?? from,
			to: name,
		}),
		icon: 'RefreshIcon',
	});

	return true;
}

/**
 * @description Moves every install the update check reports as renamed, one after another.
 * @param renames The renames the update server reported.
 * @param options `install` installs an addon from the marketplace by id.
 */
export async function moveRenamedAddons(
	renames: AddonRename[],
	options: RenameOptions,
): Promise<void> {
	for (const rename of renames) {
		try {
			await moveRenamedAddon(rename, options);
		} catch (error) {
			logger.error(`Failed to move ${rename.from} to ${rename.to}:`, error);
		}
	}
}

export default { moveRenamedAddon, moveRenamedAddons };

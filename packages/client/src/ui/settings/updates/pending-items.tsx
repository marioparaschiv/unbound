import type { LoaderUpdate } from '@unbound-app/contracts/loader';
import type { Navigation } from '@unbound-app/types/components';

import type { DiscordBuilds } from '~/updates/discord-builds';
import type { PendingUpdate } from '~/updates/addon-updates';
import { getLoader } from '~/native/unbound-native';
import { Manager } from '~/addons/manager';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import { openAddonChangelog } from './open-addon-changelog';
import LoaderUpdateButton from './loader-update-button';
import { openChangelog } from './open-changelog';

/** One pending update as the summary lists it: what moves, from which version to which. */
export type PendingItem = {
	key: string;
	name: string;
	icon: number | undefined;
	from: string;
	to: string;
	/** Opens its changelog, with the action that applies it. */
	open: (navigation: Navigation) => void;
};

/**
 * @description Lists every pending update for the summary, the loader first.
 * @param updates The addon updates waiting.
 * @param loader The loader update, or `null` when there is none.
 * @param discord The patched Discord's builds, which the loader's update installs from when it can.
 * @returns The items, in the order they show.
 */
export function listPendingItems(
	updates: PendingUpdate[],
	loader: LoaderUpdate | null,
	discord: DiscordBuilds | null,
): PendingItem[] {
	const addons = updates.map((pending) => ({
		key: pending.id,
		name: pending.name,
		icon: icons[Manager.for(pending.kind).icon],
		from: pending.from,
		to: pending.update.version,
		open: (navigation: Navigation) => openAddonChangelog(navigation, pending),
	}));

	if (!loader) {
		return addons;
	}

	const from = getLoader()?.version ?? '?';

	return [
		{
			key: 'loader',
			name: messages.UNBOUND_UPDATES_LOADER,
			icon: icons.WrenchIcon,
			from,
			to: loader.version,
			open: (navigation) =>
				openChangelog(navigation, {
					name: messages.UNBOUND_UPDATES_LOADER,
					icon: icons.WrenchIcon,
					installed: from,
					offered: loader.version,
					changelogs: loader.changelogs,
					action: <LoaderUpdateButton update={loader} discord={discord} size='lg' />,
				}),
		},
		...addons,
	];
}

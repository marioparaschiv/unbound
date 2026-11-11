import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { createLogger } from '@unbound-app/logger';
import { useState } from 'react';

import { installsFromManifest } from '~/addons/installs-from-manifest';
import type { InstallStatus } from '~/marketplace/catalog';
import type { UpdatableKind } from '~/addons/manager-of';
import type { AvailableChoice } from '~/addons/versions';
import { pickInstallVersion } from '~/addons/versions';
import { CLIENT_VERSION } from '~/core/constants';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { icons } from '~/assets/api';
import { show } from '~/toasts/api';

import { confirmChoice, installChoice, openVersionPicker } from './version-choice';
import useInstallStatus from './use-install-status';

type StatusAction = {
	label: () => string;
	variant: 'primary' | 'secondary';
	/** Names the tap's action, for the long-press menu; absent when a tap does nothing. */
	offer?: (version: string) => string;
};

/** What an install button shows and does for one listed addon. */
export type InstallAction = {
	label: string;
	variant: 'primary' | 'secondary';
	/** An install started from this button is running. */
	loading: boolean;
	press: () => Promise<void>;
	/** Offers the newest version or a version picker; absent for kinds that don't install from a manifest. */
	hold?: () => void;
};

const logger = createLogger('Marketplace', 'Install');

const ACTIONS: Record<InstallStatus, StatusAction> = {
	install: {
		label: () => messages.UNBOUND_INSTALL,
		variant: 'primary',
		offer: (version) => format('UNBOUND_INSTALL_VERSION', { version }),
	},
	update: {
		label: () => messages.UNBOUND_UPDATE,
		variant: 'primary',
		offer: (version) => format('UNBOUND_UPDATE_TO_VERSION', { version }),
	},
	installed: { label: () => messages.UNBOUND_INSTALLED, variant: 'secondary' },
};

/**
 * @description Drives a listed addon's Install, Update or Installed button, judged against the installed
 * copy. A tap installs the newest version this client runs; holding offers it or a picker of every version, except for fonts.
 * @param kind The manager the addon belongs to.
 * @param addon The listed addon.
 * @returns The button's label, variant, loading state and handlers.
 */
function useInstallAction(kind: AddonKind, addon: ListedAddon): InstallAction {
	const status = useInstallStatus(kind, addon);
	// Holds the pressed action until it settles, so the label doesn't flip while the button spins.
	const [pending, setPending] = useState<InstallStatus | null>(null);
	const { manifest, version: latest } = addon.latestVersion;
	const action = ACTIONS[pending ?? status];
	const updatable = installsFromManifest(kind) ? kind : undefined;

	async function run(install: () => Promise<boolean>): Promise<boolean> {
		setPending(status);

		const ok = await install();

		setPending(null);

		return ok;
	}

	function fail(content: string) {
		show({ title: manifest.name, content, icon: 'CircleXIcon' });
	}

	async function press() {
		if (!action.offer || pending) return;

		const ok = await run(async () => {
			const installed = Manager.for(kind).getInstalledVersion(addon);
			const picked = await pickInstallVersion(addon, installed, CLIENT_VERSION).catch(
				(cause: unknown) => {
					logger.error(`Failed to fetch the versions of ${addon.id}:`, cause);
				},
			);

			if (!picked) {
				return false;
			}

			if (picked.type === 'incompatible') {
				fail(format('UNBOUND_VERSION_NEEDS_CLIENT', { version: picked.requires }));

				return true;
			}

			return Manager.for(kind).installListed(addon, picked.version);
		});

		if (!ok) {
			fail(format('UNBOUND_INSTALL_FAILED', { name: manifest.name }));
		}
	}

	async function pick(kind: UpdatableKind, choice: AvailableChoice) {
		const target = { kind, id: addon.id, name: manifest.name };

		if (pending || !(await confirmChoice(target, choice))) return;

		await run(() => installChoice(target, choice));
	}

	function openPicker(kind: UpdatableKind) {
		openVersionPicker(
			{ kind, id: addon.id, name: manifest.name },
			(choice) => void pick(kind, choice),
		);
	}

	// The installed state has nothing else to offer, so a menu would only cost a tap.
	function hold(kind: UpdatableKind) {
		if (pending) return;

		if (!action.offer) {
			openPicker(kind);

			return;
		}

		Discord.showSimpleActionSheet({
			key: 'unbound-install-options',
			header: { title: manifest.name },
			options: [
				{
					label: action.offer(latest),
					icon: icons['DownloadIcon'],
					onPress: () => void press(),
				},
				{
					label: messages.UNBOUND_CHOOSE_VERSION,
					icon: icons['ClockIcon'],
					onPress: () => openPicker(kind),
				},
			],
		});
	}

	return {
		label: action.label(),
		variant: action.variant,
		loading: Boolean(pending),
		press,
		hold: updatable === undefined ? void 0 : () => hold(updatable),
	};
}

export default useInstallAction;

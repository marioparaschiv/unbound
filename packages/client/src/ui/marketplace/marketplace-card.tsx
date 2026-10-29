import type { ListedAddon } from '@unbound-app/contracts/addons';
import { memo, useState } from 'react';
import { View } from 'react-native';

import { brokenDependents } from '~/lib/addon-dependencies';
import type { AvailableChoice } from '~/lib/addon-versions';
import AddonCardHeader from '~/ui/addons/addon-card-header';
import type { InstallStatus } from '~/lib/catalog';
import type { UpdatableKind } from '~/lib/updates';
import { Discord } from '~/api/metro/components';
import { compareVersions } from '~/lib/catalog';
import { ActionSheets } from '~/api/metro/api';
import { Messages, format } from '~/api/i18n';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { showToast } from '~/api/toasts';
import { confirm } from '~/api/dialogs';
import { Icons } from '~/api/assets';

import type { MarketplaceTab } from './targets';

import { getInstalledVersion, installFont, installVersion } from './targets';
import VersionPickerSheet from './version-picker-sheet';
import useInstallStatus from './use-install-status';
import useStyles from './marketplace-card.style';

type MarketplaceCardProps = {
	addon: ListedAddon;
	tab: MarketplaceTab;
};

type StatusAction = {
	label: () => string;
	variant: 'primary' | 'secondary';
	/** Names the tap's action, for the long-press menu; absent when a tap does nothing. */
	offer?: (version: string) => string;
};

const ACTIONS: Record<InstallStatus, StatusAction> = {
	install: {
		label: () => Messages.UNBOUND_INSTALL,
		variant: 'primary',
		offer: (version) => format('UNBOUND_INSTALL_VERSION', { version }),
	},
	update: {
		label: () => Messages.UNBOUND_UPDATE,
		variant: 'primary',
		offer: (version) => format('UNBOUND_UPDATE_TO_VERSION', { version }),
	},
	installed: { label: () => Messages.UNBOUND_INSTALLED, variant: 'secondary' },
};

const SHEET_KEY = 'unbound-addon-versions';

// Asks when the choice pauses updates, goes back a version or breaks a dependent; an upgrade to the latest just installs.
function confirmChoice(
	kind: UpdatableKind,
	addon: ListedAddon,
	choice: AvailableChoice,
): Promise<boolean> {
	const { name } = addon.latestVersion.manifest;
	const { version } = choice.version;
	const installed = getInstalledVersion(kind, addon);
	const broken = brokenDependents(addon.id, version, getManager(kind).getEntities());
	const downgrade = installed !== void 0 && compareVersions(version, installed) < 0;

	if (!choice.holds && !downgrade && broken.length === 0) {
		return Promise.resolve(true);
	}

	const lines = [
		choice.holds ? format('UNBOUND_VERSION_CONFIRM_HOLD', { name }) : null,
		downgrade ? format('UNBOUND_VERSION_CONFIRM_DOWNGRADE', { installed }) : null,
		broken.length > 0
			? format('UNBOUND_VERSION_CONFIRM_BROKEN', {
					names: broken.map((dependent) => dependent.data.name).join(', '),
				})
			: null,
	];

	return confirm({
		title: format('UNBOUND_VERSION_CONFIRM_TITLE', { name, version }),
		body: lines.filter(Boolean).join('\n\n'),
		confirmLabel: Messages.UNBOUND_INSTALL,
		cancelLabel: Messages.UNBOUND_CANCEL,
	});
}

/**
 * @description One listed addon: the same header as an installed addon's card, with an Install, Update
 * or Installed button judged against the installed copy at its top right. Holding the button offers
 * the newest version or a picker of every version, except for fonts.
 */
function MarketplaceCard({ addon, tab }: MarketplaceCardProps) {
	const styles = useStyles();
	const status = useInstallStatus(tab.kind, addon);
	// Holds the pressed action until it settles, so the label doesn't flip while the button spins.
	const [pending, setPending] = useState<InstallStatus | null>(null);
	const { manifest, version: latest } = addon.latestVersion;
	const action = ACTIONS[pending ?? status];
	const updatable = tab.kind === ManagerKind.Fonts ? undefined : tab.kind;

	async function run(install: () => Promise<boolean>): Promise<boolean> {
		setPending(status);

		const ok = await install();

		setPending(null);

		return ok;
	}

	function fail(content: string) {
		showToast({ title: manifest.name, content, icon: 'CircleXIcon' });
	}

	async function press() {
		if (!action.offer || pending) return;

		const ok = await run(() =>
			updatable === undefined
				? installFont(addon)
				: installVersion(updatable, addon, addon.latestVersion),
		);

		if (!ok) {
			fail(format('UNBOUND_INSTALL_FAILED', { name: manifest.name }));
		}
	}

	async function pick(kind: UpdatableKind, choice: AvailableChoice) {
		if (pending || !(await confirmChoice(kind, addon, choice))) return;

		const vars = { name: manifest.name, version: choice.version.version };
		const ok = await run(() => installVersion(kind, addon, choice.version, choice.holds));

		if (!ok) {
			fail(format('UNBOUND_VERSION_FAILED', vars));

			return;
		}

		if (choice.holds) {
			showToast({
				title: manifest.name,
				content: format('UNBOUND_VERSION_HELD_TOAST', vars),
				icon: 'CircleCheckIcon',
			});
		}
	}

	function openPicker(kind: UpdatableKind) {
		ActionSheets.openLazy(Promise.resolve({ default: VersionPickerSheet }), SHEET_KEY, {
			kind,
			addon,
			onPick: (choice: AvailableChoice) => void pick(kind, choice),
			onClose: () => ActionSheets.hideActionSheet(SHEET_KEY),
		});
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
					icon: Icons['DownloadIcon'],
					onPress: () => void press(),
				},
				{
					label: Messages.UNBOUND_CHOOSE_VERSION,
					icon: Icons['ClockIcon'],
					onPress: () => openPicker(kind),
				},
			],
		});
	}

	return (
		<Discord.Card variant='primary' border='subtle' shadow='low' style={styles.card}>
			<View style={styles.row}>
				<View style={styles.body}>
					<AddonCardHeader manifest={manifest} icon={tab.icon} />
				</View>
				<Discord.Button
					size='sm'
					text={action.label()}
					variant={action.variant}
					loading={Boolean(pending)}
					onPress={press}
					onLongPress={updatable === undefined ? void 0 : () => hold(updatable)}
				/>
			</View>
		</Discord.Card>
	);
}

export default memo(MarketplaceCard);

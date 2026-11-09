import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { memo, useState } from 'react';
import { View } from 'react-native';

import { getInstalledVersion, installVersion } from '~/marketplace/install';
import type { InstallStatus } from '~/marketplace/catalog';
import { brokenDependents } from '~/addons/dependencies';
import type { UpdatableKind } from '~/addons/manager-of';
import type { AvailableChoice } from '~/addons/versions';
import { installsFromManifest } from '~/addons/addons';
import AddonAuthors from '~/ui/addons/addon-authors';
import AddonTitle from '~/ui/components/addon-title';
import AddonIcon from '~/ui/components/addon-icon';
import { compareVersions } from '~/core/versions';
import { confirmText } from '~/dialogs/feedback';
import AddonTag from '~/ui/components/addon-tag';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { showDialog } from '~/dialogs/api';
import { ActionSheets } from '~/metro/api';
import { icons } from '~/assets/api';
import { show } from '~/toasts/api';

import VersionPickerSheet from './version-picker-sheet';
import useInstallStatus from './use-install-status';
import useStyles from './marketplace-card.style';
import useOpenListing from './use-open-listing';

type MarketplaceCardProps = {
	addon: ListedAddon;
	kind: AddonKind;
};

type StatusAction = {
	label: () => string;
	variant: 'primary' | 'secondary';
	/** Names the tap's action, for the long-press menu; absent when a tap does nothing. */
	offer?: (version: string) => string;
};

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
	const broken = brokenDependents(addon.id, version, Manager.for(kind).getEntities());
	const downgrade = installed !== void 0 && compareVersions(version, installed) < 0;

	if (!choice.holds && !downgrade && broken.length === 0) {
		return Promise.resolve(true);
	}

	const lines = [
		choice.holds ? format('UNBOUND_VERSION_CONFIRM_HOLD', { name }) : null,
		downgrade ? format('UNBOUND_VERSION_CONFIRM_DOWNGRADE', { installed }) : null,
		broken.length > 0
			? format('UNBOUND_VERSION_CONFIRM_BROKEN', {
					names: broken.map((dependent) => dependent.manifest.name).join(', '),
				})
			: null,
	];

	// The body joins whichever warnings apply, so it is composed here rather than one message key.
	return confirmText(showDialog, {
		title: format('UNBOUND_VERSION_CONFIRM_TITLE', { name, version }),
		body: lines.filter(Boolean).join('\n\n'),
		confirm: messages.UNBOUND_INSTALL,
		cancel: messages.UNBOUND_CANCEL,
	});
}

/**
 * @description One listed addon, laid out like an installed addon's card: icon, name and authors on top
 * with an Install, Update or Installed button judged against the installed copy at its top right, the
 * description and version below. Holding the button offers
 * the newest version or a picker of every version, except for fonts. Tapping the card opens the store page.
 */
function MarketplaceCard({ addon, kind }: MarketplaceCardProps) {
	const styles = useStyles();
	const open = useOpenListing();
	const status = useInstallStatus(kind, addon);
	// Holds the pressed action until it settles, so the label doesn't flip while the button spins.
	const [pending, setPending] = useState<InstallStatus | null>(null);
	const { manifest, version: latest, pageUrl } = addon.latestVersion;
	const name = addon.name ?? manifest.name;
	const description = addon.description ?? manifest.description;
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

		const ok = await run(() => installVersion(kind, addon, addon.latestVersion));

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
			show({
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

	return (
		<Discord.Card
			variant='primary'
			border='subtle'
			shadow='low'
			style={styles.card}
			onPress={pageUrl ? () => open(addon, kind) : void 0}
		>
			<Discord.Stack direction='horizontal' spacing={12} align='flex-start'>
				<AddonIcon id={addon.id} kind={kind} />
				<View style={styles.heading}>
					<AddonTitle name={name} />
					{manifest.authors.length ? <AddonAuthors authors={manifest.authors} /> : null}
				</View>
				<Discord.Button
					size='sm'
					text={action.label()}
					variant={action.variant}
					loading={Boolean(pending)}
					onPress={press}
					onLongPress={updatable === undefined ? void 0 : () => hold(updatable)}
				/>
			</Discord.Stack>
			<View style={styles.bottom}>
				{description ? (
					<Discord.Text variant='text-sm/normal' style={styles.description}>
						{description}
					</Discord.Text>
				) : (
					<View style={styles.spacer} />
				)}
				<AddonTag>{`v${latest}`}</AddonTag>
			</View>
		</Discord.Card>
	);
}

export default memo(MarketplaceCard);

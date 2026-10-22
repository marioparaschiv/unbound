import type { ListedAddon } from '@unbound-app/contracts/addons';
import { memo, useState } from 'react';
import { View } from 'react-native';

import AddonCardHeader from '~/ui/addons/addon-card-header';
import type { InstallStatus } from '~/lib/catalog';
import { Discord } from '~/api/metro/components';
import { Messages, format } from '~/api/i18n';
import { showToast } from '~/api/toasts';

import type { MarketplaceTab } from './targets';

import { installListed, updateListed } from './targets';
import useInstallStatus from './use-install-status';
import useStyles from './marketplace-card.style';

type MarketplaceCardProps = {
	addon: ListedAddon;
	tab: MarketplaceTab;
};

type StatusAction = {
	label: () => string;
	variant: 'primary' | 'secondary';
	run?: typeof installListed;
};

const ACTIONS: Record<InstallStatus, StatusAction> = {
	install: { label: () => Messages.UNBOUND_INSTALL, variant: 'primary', run: installListed },
	update: { label: () => Messages.UNBOUND_UPDATE, variant: 'primary', run: updateListed },
	installed: { label: () => Messages.UNBOUND_INSTALLED, variant: 'secondary' },
};

/**
 * @description One listed addon: the same header as an installed addon's card, with an Install, Update
 * or Installed button judged against the installed copy at its top right.
 */
function MarketplaceCard({ addon, tab }: MarketplaceCardProps) {
	const styles = useStyles();
	const status = useInstallStatus(tab.kind, addon);
	// Holds the pressed action until it settles, so the label doesn't flip while the button spins.
	const [pending, setPending] = useState<InstallStatus | null>(null);
	const { manifest } = addon.latestVersion;
	const action = ACTIONS[pending ?? status];

	async function press() {
		if (!action.run || pending) return;

		setPending(status);

		const ok = await action.run(tab.kind, addon);

		setPending(null);

		if (!ok) {
			showToast({
				title: manifest.name,
				content: format('UNBOUND_INSTALL_FAILED', { name: manifest.name }),
				icon: 'CircleXIcon',
			});
		}
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
					disabled={!action.run}
					loading={Boolean(pending)}
					onPress={press}
				/>
			</View>
		</Discord.Card>
	);
}

export default memo(MarketplaceCard);

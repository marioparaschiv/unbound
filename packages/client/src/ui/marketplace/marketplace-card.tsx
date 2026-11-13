import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { View } from 'react-native';
import { memo } from 'react';

import { newListingsSince } from '~/marketplace/new-since';
import { isNewListing } from '~/marketplace/catalog';
import AddonAuthors from '~/ui/addons/addon-authors';
import AddonTitle from '~/ui/components/addon-title';
import AddonIcon from '~/ui/components/addon-icon';
import AddonTag from '~/ui/components/addon-tag';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import InstallCountLabel from './install-count-label';
import useInstallAction from './use-install-action';
import useStyles from './marketplace-card.style';
import useOpenListing from './use-open-listing';
import TagRow from './tag-row';

type MarketplaceCardProps = {
	addon: ListedAddon;
	kind: AddonKind;
};

/**
 * @description One listed addon, laid out like an installed addon's card: icon, name and authors on top
 * with an Install, Update or Installed button judged against the installed copy at its top right, the
 * description below, then the tags in a scrolling row beside the install count and version. Holding the button offers
 * the newest version or a picker of every version, except for fonts. Tapping the card opens the addon page.
 */
function MarketplaceCard({ addon, kind }: MarketplaceCardProps) {
	const styles = useStyles();
	const open = useOpenListing();
	const install = useInstallAction(kind, addon);
	const { manifest, version: latest, pageUrl } = addon.latestVersion;
	const name = addon.name ?? manifest.name;
	const description = addon.description ?? manifest.description;
	const tags = addon.tags ?? [];
	const installs = addon.installs ?? 0;
	const meta = (
		<View style={styles.meta}>
			{installs ? <InstallCountLabel count={installs} /> : null}
			<AddonTag>{`v${latest}`}</AddonTag>
		</View>
	);

	return (
		<Discord.Card
			variant='primary'
			border='subtle'
			shadow='low'
			style={styles.card}
			onPress={pageUrl ? () => open(addon, kind) : void 0}
		>
			<Discord.Stack direction='horizontal' spacing={12} align='center'>
				<AddonIcon id={addon.id} kind={kind} />
				<View style={styles.heading}>
					<AddonTitle
						name={name}
						tag={
							isNewListing(addon, Date.now(), newListingsSince())
								? messages.UNBOUND_MARKETPLACE_NEW
								: undefined
						}
						tagVariant='new'
					/>
					{manifest.authors.length ? <AddonAuthors authors={manifest.authors} /> : null}
				</View>
				<Discord.Button
					size='sm'
					text={install.label}
					variant={install.variant}
					loading={install.loading}
					onPress={install.press}
					onLongPress={install.hold}
				/>
			</Discord.Stack>
			{tags.length ? (
				<>
					{description ? (
						<Discord.Text
							variant='text-sm/normal'
							style={[styles.description, styles.above]}
						>
							{description}
						</Discord.Text>
					) : null}
					<View style={styles.footer}>
						<TagRow tags={tags} />
						{meta}
					</View>
				</>
			) : (
				<View style={styles.bottom}>
					{description ? (
						<Discord.Text variant='text-sm/normal' style={styles.description}>
							{description}
						</Discord.Text>
					) : (
						<View style={styles.spacer} />
					)}
					{meta}
				</View>
			)}
		</Discord.Card>
	);
}

export default memo(MarketplaceCard);

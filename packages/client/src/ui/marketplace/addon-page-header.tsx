import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { View } from 'react-native';

import AddonAuthors from '~/ui/addons/addon-authors';
import AddonIcon from '~/ui/components/addon-icon';
import { Discord } from '~/metro/components';
import { format } from '~/i18n/api';

import InstallCountLabel from './install-count-label';
import useInstallAction from './use-install-action';
import { formatListingDate } from './listing-date';
import useStyles from './addon-page-header.style';

type AddonPageHeaderProps = {
	addon: ListedAddon;
	kind: AddonKind;
};

/**
 * @description The top of a addon page, as the website's addon header: the icon, name, version,
 * update date and install count, the authors and description, and a full-width Install, Update or Installed button.
 * It reads only the listing, so it draws before the page's ADDON.md arrives.
 */
function AddonPageHeader({ addon, kind }: AddonPageHeaderProps) {
	const styles = useStyles();
	const install = useInstallAction(kind, addon);
	const { manifest, version, publishedAt } = addon.latestVersion;
	const description = addon.description ?? manifest.description;
	const updated = format('UNBOUND_STORE_PAGE_UPDATED', { date: formatListingDate(publishedAt) });

	return (
		<View style={styles.header}>
			<View style={styles.identity}>
				<AddonIcon id={addon.id} kind={kind} size='large' />
				<View style={styles.titles}>
					<Discord.Text variant='heading-xl/bold' style={styles.name} numberOfLines={2}>
						{addon.name ?? manifest.name}
					</Discord.Text>
					<View style={styles.metaRow}>
						<Discord.Text variant='text-sm/medium' style={styles.meta}>
							{`v${version} · ${updated}`}
						</Discord.Text>
						{addon.installs ? (
							<InstallCountLabel count={addon.installs} variant='page' />
						) : null}
					</View>
				</View>
			</View>
			{manifest.authors.length ? <AddonAuthors authors={manifest.authors} /> : null}
			{description ? (
				<Discord.Text variant='text-md/normal' style={styles.description}>
					{description}
				</Discord.Text>
			) : null}
			<Discord.Button
				size='lg'
				grow
				text={install.label}
				variant={install.variant}
				loading={install.loading}
				onPress={install.press}
				onLongPress={install.hold}
			/>
		</View>
	);
}

export default AddonPageHeader;

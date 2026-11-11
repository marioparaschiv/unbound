import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { memo } from 'react';

import AddonIcon from '~/ui/components/addon-icon';
import { Discord } from '~/metro/components';

import useOpenListing from './use-open-listing';
import useStyles from './featured-card.style';

type FeaturedCardProps = {
	addon: ListedAddon;
	kind: AddonKind;
};

/**
 * @description One addon on the Featured shelf: a compact card of its icon beside its name on one line.
 * Tapping it opens the addon page.
 */
function FeaturedCard({ addon, kind }: FeaturedCardProps) {
	const styles = useStyles();
	const open = useOpenListing();
	const name = addon.name ?? addon.latestVersion.manifest.name;

	return (
		<Discord.Card
			variant='primary'
			border='subtle'
			shadow='low'
			style={styles.card}
			accessibilityRole='button'
			accessibilityLabel={name}
			onPress={() => open(addon, kind)}
		>
			<AddonIcon id={addon.id} kind={kind} />
			<Discord.Text variant='text-md/semibold' style={styles.name} numberOfLines={1}>
				{name}
			</Discord.Text>
		</Discord.Card>
	);
}

export default memo(FeaturedCard);

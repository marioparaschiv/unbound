import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { RefreshControl, View } from 'react-native';
import { memo, useState } from 'react';

import MarketplaceStore from '~/marketplace/state';
import FlashList from '~/ui/components/flash-list';
import { messages, format } from '~/i18n/api';
import { SafeArea } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { show } from '~/toasts/api';

import MarketplaceCard from './marketplace-card';
import useStyles from './marketplace-list.style';
import FeaturedShelf from './featured-shelf';
import SectionTitle from './section-title';

export type PageSize = { width: number; height: number };

type MarketplaceRowsProps = {
	kind: AddonKind;
	addons: ListedAddon[];
	featured: ListedAddon[];
	pageSize: PageSize;
	/** Whether this tab is the one on screen; the rows hold their last render while it is not. */
	active: boolean;
};

type CardInfo = { item: ListedAddon };

const keyOf = (addon: ListedAddon) => addon.id;

/**
 * @description A marketplace tab's virtualised cards under the Featured shelf. Pulling down refreshes the
 * catalog; a failed refresh keeps the stored copy and says so.
 */
function MarketplaceRows({ kind, addons, featured, pageSize }: MarketplaceRowsProps) {
	const styles = useStyles();
	// Only a pull shows the spinner, so the background refresh on open doesn't shift the list.
	const [pulling, setPulling] = useState(false);
	const plural = messages[Manager.for(kind).label];

	async function pull() {
		setPulling(true);

		const ok = await MarketplaceStore.getState().refresh();

		setPulling(false);

		if (!ok && MarketplaceStore.getState().state.status === 'ready') {
			show({
				title: messages.UNBOUND_MARKETPLACE,
				content: messages.UNBOUND_MARKETPLACE_REFRESH_FAILED,
				icon: 'CircleXIcon',
			});
		}
	}

	function renderCard({ item }: CardInfo) {
		return (
			<View style={styles.card}>
				<MarketplaceCard addon={item} kind={kind} />
			</View>
		);
	}

	return (
		<FlashList
			key={Math.round(pageSize.width)}
			data={addons}
			keyExtractor={keyOf}
			renderItem={renderCard}
			estimatedItemSize={160}
			estimatedListSize={pageSize}
			ListHeaderComponent={
				featured.length ? (
					<View style={styles.header}>
						<FeaturedShelf addons={featured} kind={kind} />
						<SectionTitle>
							{format('UNBOUND_MARKETPLACE_ALL', { type: plural })}
						</SectionTitle>
					</View>
				) : undefined
			}
			// The bottom inset pads the end of the list, so the cards scroll under the home indicator, as on the Plugins page.
			ListFooterComponent={<SafeArea.SafeAreaPaddingView bottom />}
			keyboardDismissMode='on-drag'
			contentContainerStyle={styles.content}
			refreshControl={
				<RefreshControl
					refreshing={pulling}
					onRefresh={pull}
					tintColor={styles.spinner.color}
				/>
			}
		/>
	);
}

// Skips renders off screen: under the pager's `display: none` the list measures every card at 0×0 and mounts them all.
export default memo(MarketplaceRows, (_, next) => !next.active);

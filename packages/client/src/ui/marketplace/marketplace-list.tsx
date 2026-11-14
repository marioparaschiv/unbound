import type { ListedAddon } from '@unbound-app/contracts/addons';
import { memo, useContext, useMemo, useState } from 'react';
import type { AddonKind } from '@unbound-app/types/addons';
import { RefreshControl, View } from 'react-native';

import { countActiveFilters, filterCatalog, pickFeatured } from '~/marketplace/filters';
import { queryCatalog } from '~/marketplace/catalog';
import MarketplaceStore from '~/marketplace/state';
import FlashList from '~/ui/components/flash-list';
import Empty from '~/ui/components/empty-state';
import { messages, format } from '~/i18n/api';
import { SafeArea } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { show } from '~/toasts/api';

import MarketplaceSkeleton from './marketplace-skeleton';
import MarketplaceCard from './marketplace-card';
import useStyles from './marketplace-list.style';
import BrowseContext from './browse-context';
import FeaturedShelf from './featured-shelf';
import SectionTitle from './section-title';

type MarketplaceListProps = {
	kind: AddonKind;
};

type CardInfo = { item: ListedAddon };

const keyOf = (addon: ListedAddon) => addon.id;

/**
 * @description One marketplace tab: the Featured shelf, then the stored catalog narrowed to the tab's
 * kind, the search and the filters, as a virtualised list of cards. The shelf steps aside while anything
 * narrows the list, and an empty state replaces the list when nothing matches.
 * Pulling down refreshes the catalog; a failed refresh keeps the stored copy and says so.
 */
function MarketplaceList({ kind }: MarketplaceListProps) {
	const styles = useStyles();
	const state = MarketplaceStore((store) => store.state);
	const { search, filters } = useContext(BrowseContext);
	// Only a pull shows the spinner, so the background refresh on open doesn't shift the list.
	const [pulling, setPulling] = useState(false);
	// Read once per mount: the Updated window and the day's Featured picks hold still while the page is open.
	const [now] = useState(Date.now);

	const browsing = !search.trim() && countActiveFilters(filters) === 0;

	const addons = useMemo(() => {
		if (state.status !== 'ready') {
			return [];
		}

		const found = queryCatalog(state.catalog.addons, {
			type: kind,
			search,
			sort: filters.sort,
		});

		return filterCatalog(found, filters, now);
	}, [state, kind, search, filters, now]);

	const featured = useMemo(
		() =>
			state.status === 'ready' && browsing
				? pickFeatured(state.catalog.addons, kind, now)
				: [],
		[state, kind, browsing, now],
	);

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

	if (state.status === 'idle' || state.status === 'loading') {
		return (
			<View style={styles.loading}>
				<MarketplaceSkeleton />
			</View>
		);
	}

	const manager = Manager.for(kind);
	const plural = messages[manager.label];

	if (!addons.length) {
		const failed = state.status === 'failed';
		const message = failed
			? messages.UNBOUND_MARKETPLACE_ERROR
			: browsing
				? format('UNBOUND_MARKETPLACE_EMPTY', { type: messages[manager.noun] })
				: messages.UNBOUND_EMPTY_RESULTS;
		const icon = failed ? 'CircleXIcon' : browsing ? 'ShopIcon' : undefined;

		return (
			// Fills the space under the controls without scrolling, so the empty state sits in its centre.
			<SafeArea.SafeAreaPaddingView bottom style={styles.empty}>
				<Empty icon={icon} tone={failed ? 'critical' : 'neutral'}>
					{message}
				</Empty>
			</SafeArea.SafeAreaPaddingView>
		);
	}

	return (
		<FlashList
			data={addons}
			keyExtractor={keyOf}
			renderItem={renderCard}
			estimatedItemSize={160}
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

export default memo(MarketplaceList);

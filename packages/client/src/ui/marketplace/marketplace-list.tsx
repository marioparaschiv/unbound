import { memo, useContext, useMemo, useState } from 'react';
import type { AddonKind } from '@unbound-app/types/addons';
import { RefreshControl, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';

import { countActiveFilters, filterCatalog, pickFeatured } from '~/marketplace/filters';
import { queryCatalog } from '~/marketplace/catalog';
import MarketplaceStore from '~/marketplace/state';
import Empty from '~/ui/components/empty-state';
import { messages, format } from '~/i18n/api';
import { SafeArea } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { show } from '~/toasts/api';

import MarketplaceSkeleton from './marketplace-skeleton';
import MarketplaceCard from './marketplace-card';
import useStyles from './marketplace-list.style';
import useCardMotion from './use-card-motion';
import BrowseContext from './browse-context';
import FeaturedShelf from './featured-shelf';
import SectionTitle from './section-title';

type MarketplaceListProps = {
	kind: AddonKind;
};

/**
 * @description One marketplace tab: the Featured shelf, then the stored catalog narrowed to the tab's
 * kind, the search and the filters, as cards. The shelf steps aside while anything narrows the list.
 * Pulling down refreshes the catalog; a failed refresh keeps the stored copy and says so.
 */
function MarketplaceList({ kind }: MarketplaceListProps) {
	const styles = useStyles();
	const state = MarketplaceStore((store) => store.state);
	const { search, filters } = useContext(BrowseContext);
	const motion = useCardMotion();
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

	const plural = messages[Manager.for(kind).label];
	const label = plural.toLowerCase();
	const empty =
		state.status === 'failed' ? (
			<Empty image='empty_permission'>{messages.UNBOUND_MARKETPLACE_ERROR}</Empty>
		) : state.status === 'ready' ? (
			<Empty image={browsing ? 'empty_permission' : 'sticker_search_empty'}>
				{!browsing
					? messages.UNBOUND_EMPTY_RESULTS
					: format('UNBOUND_MARKETPLACE_EMPTY', { type: label })}
			</Empty>
		) : (
			<MarketplaceSkeleton />
		);

	return (
		<ScrollView
			contentContainerStyle={styles.list}
			keyboardDismissMode='on-drag'
			refreshControl={
				<RefreshControl
					refreshing={pulling}
					onRefresh={pull}
					tintColor={styles.spinner.color}
				/>
			}
		>
			{featured.length ? (
				<>
					<FeaturedShelf addons={featured} kind={kind} />
					<SectionTitle>
						{format('UNBOUND_MARKETPLACE_ALL', { type: plural })}
					</SectionTitle>
				</>
			) : null}
			{addons.length
				? addons.map((addon) => (
						<Animated.View key={addon.id} {...motion}>
							<MarketplaceCard addon={addon} kind={kind} />
						</Animated.View>
					))
				: empty}
			{/* The bottom inset pads the end of the list, so the cards scroll under the home indicator, as on the Plugins page. */}
			<SafeArea.SafeAreaPaddingView bottom />
		</ScrollView>
	);
}

export default memo(MarketplaceList);

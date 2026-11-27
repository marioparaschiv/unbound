// Reads manager or settings state during render, which the React Compiler would cache past its changes.
'use no memo';

import { useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { pickFeatured } from '@unbound-app/contracts/featured-addons';
import type { ListedAddon } from '@unbound-app/contracts/addons';
import { memo, useContext, useMemo, useState } from 'react';
import type { AddonKind } from '@unbound-app/types/addons';
import { useStore } from 'zustand';

import { countActiveFilters, filterCatalog } from '~/marketplace/filters';
import { queryCatalog } from '~/marketplace/catalog';
import MarketplaceStore from '~/marketplace/state';
import Empty from '~/ui/components/empty-state';
import { messages, format } from '~/i18n/api';
import { SafeArea } from '~/metro/components';
import { Manager } from '~/addons/manager';

import MarketplaceRows, { type PageSize } from './marketplace-rows';
import useInstalledRevision from './use-installed-revision';
import MarketplaceSkeleton from './marketplace-skeleton';
import useStyles from './marketplace-list.style';
import BrowseContext from './browse-context';

/** Cards a hidden tab mounts ahead of its first visit: a screenful, so the tab opens drawn. */
const PREFETCH_CARDS = 8;

type MarketplaceListProps = {
	kind: AddonKind;
};

/**
 * @description One marketplace tab: the Featured shelf, then the stored catalog narrowed to the tab's
 * kind, the search and the filters, as a virtualised list of cards. The shelf steps aside while anything
 * narrows the list, and an empty state replaces the list when nothing matches.
 * A hidden tab prefetches only its first cards: the pager hides it with `display: none`, where the list measures
 * 0×0 and mounts every card it holds. The whole list arrives once the tab is on screen.
 */
function MarketplaceList({ kind }: MarketplaceListProps) {
	const styles = useStyles();
	const state = useStore(MarketplaceStore, (store) => store.state);
	const { search, filters, tab } = useContext(BrowseContext);
	// Read once per mount: the Updated window and the day's Featured picks hold still while the page is open.
	const [now] = useState(Date.now);
	const [pageSize, setPageSize] = useState<PageSize | undefined>();
	const window = useWindowDimensions();
	const active = tab === kind;
	const [visited, setVisited] = useState(active);

	if (active && !visited) {
		setVisited(true);
	}

	// A hidden page never lays out, so a prefetched list starts from the window's size; a shown one waits for its own.
	const size = pageSize ?? (visited ? undefined : { width: window.width, height: window.height });

	const installs = useInstalledRevision(kind);
	const browsing = !search.trim() && countActiveFilters(filters) === 0;

	function isInstalled(addon: ListedAddon) {
		return Manager.for(kind).getInstalledVersion(addon) !== undefined;
	}

	const addons = useMemo(() => {
		if (state.status !== 'ready') {
			return [];
		}

		const found = queryCatalog(state.catalog.addons, {
			type: kind,
			search,
			sort: filters.sort,
		});

		return filterCatalog(found, filters, now, isInstalled);
	}, [state, kind, search, filters, now, installs]);

	const featured = useMemo(
		() =>
			state.status === 'ready' && browsing
				? pickFeatured(state.catalog.addons, kind, now)
				: [],
		[state, kind, browsing, now],
	);

	function measurePage(event: LayoutChangeEvent) {
		const { width, height } = event.nativeEvent.layout;

		if (width > 0 && height > 0) {
			setPageSize({ width, height });
		}
	}

	if (state.status === 'idle' || state.status === 'loading') {
		return (
			<View style={styles.loading}>
				<MarketplaceSkeleton />
			</View>
		);
	}

	if (!addons.length) {
		const failed = state.status === 'failed';
		const searching = Boolean(search.trim());
		const type = messages[Manager.for(kind).noun];
		const message = failed
			? messages.UNBOUND_MARKETPLACE_ERROR
			: browsing
				? format('UNBOUND_MARKETPLACE_EMPTY', { type })
				: searching
					? messages.UNBOUND_EMPTY_RESULTS
					: format('UNBOUND_MARKETPLACE_NO_MATCH', { type });
		const icon = failed
			? 'CircleXIcon'
			: browsing
				? 'ShopIcon'
				: searching
					? undefined
					: 'FiltersHorizontalIcon';

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
		<View style={styles.page} onLayout={measurePage}>
			{size ? (
				<MarketplaceRows
					kind={kind}
					addons={visited ? addons : addons.slice(0, PREFETCH_CARDS)}
					featured={featured}
					pageSize={size}
					active={active}
				/>
			) : (
				<View style={styles.loading}>
					<MarketplaceSkeleton />
				</View>
			)}
		</View>
	);
}

export default memo(MarketplaceList);

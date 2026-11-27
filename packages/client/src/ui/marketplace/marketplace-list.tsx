// Reads manager or settings state during render, which the React Compiler would cache past its changes.
'use no memo';

import { pickFeatured } from '@unbound-app/contracts/featured-addons';
import type { ListedAddon } from '@unbound-app/contracts/addons';
import { memo, useContext, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
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

type MarketplaceListProps = {
	kind: AddonKind;
};

/**
 * @description One marketplace tab: the Featured shelf, then the stored catalog narrowed to the tab's
 * kind, the search and the filters, as a virtualised list of cards. The shelf steps aside while anything
 * narrows the list, and an empty state replaces the list when nothing matches.
 * The list mounts once its tab has been on screen and its page has laid out with a real size, and is told
 * that size: mounted on a page the pager hides, it measures 0×0 and mounts every card at once.
 */
function MarketplaceList({ kind }: MarketplaceListProps) {
	const styles = useStyles();
	const state = useStore(MarketplaceStore, (store) => store.state);
	const { search, filters, tab } = useContext(BrowseContext);
	// Read once per mount: the Updated window and the day's Featured picks hold still while the page is open.
	const [now] = useState(Date.now);
	const [pageSize, setPageSize] = useState<PageSize | undefined>();
	const active = tab === kind;
	const [visited, setVisited] = useState(active);

	if (active && !visited) {
		setVisited(true);
	}

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
			{pageSize && visited ? (
				<MarketplaceRows
					kind={kind}
					addons={addons}
					featured={featured}
					pageSize={pageSize}
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

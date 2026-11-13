import { useEffect, useMemo, useRef, useState } from 'react';
import type { AddonKind } from '@unbound-app/types/addons';
import { ADDON_KINDS } from '@unbound-app/types/addons';
import { Dimensions, View } from 'react-native';

import { offerListedInstall } from '~/ui/marketplace/offer-listed-install';
import MarketplaceList from '~/ui/marketplace/marketplace-list';
import BrowseContext from '~/ui/marketplace/browse-context';
import FilterButton from '~/ui/marketplace/filter-button';
import { DEFAULT_FILTERS } from '~/marketplace/filters';
import FilterChips from '~/ui/marketplace/filter-chips';
import MarketplaceStore from '~/marketplace/state';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';

import useStyles from './marketplace.style';

type MarketplaceParams = {
	/** Opens on the tab of this manager, e.g. the page the install menu was opened from. */
	kind?: AddonKind;
	/** Narrows the search to this addon and offers to install it, e.g. from an `unbound://` link. */
	id?: string;
	/** Tells one open of `id` from the next, so opening the same link again asks again. */
	request?: number;
};

type MarketplacePageProps = {
	route: { params?: MarketplaceParams };
};

/**
 * @description The addon marketplace, laid out like the addon pages: a pinned search beside a Sort & Filter
 * button, the active filters, and one swipeable tab per addon type listing the catalog stored on device.
 * Opening the page refreshes the catalog in the background.
 */
function MarketplacePage({ route }: MarketplacePageProps) {
	const styles = useStyles();
	const { kind, id, request } = route.params ?? {};
	const [search, setSearch] = useState(id ?? '');
	const [filters, setFilters] = useState(DEFAULT_FILTERS);
	const [tab, setTab] = useState(kind ? ADDON_KINDS.indexOf(kind) : 0);
	const browse = useMemo(() => ({ search, filters }), [search, filters]);
	const active = ADDON_KINDS[tab] ?? 'plugin';
	// Read only to offer a linked addon: each tab subscribes on its own, so catalog loads skip re-rendering the page.
	const catalog = MarketplaceStore((store) => (id ? store.state : undefined));
	const lastOfferedOpen = useRef<string | undefined>(undefined);

	useEffect(() => {
		void MarketplaceStore.getState().load();
	}, []);

	const items = useMemo(
		() =>
			ADDON_KINDS.map((tab) => ({
				id: tab,
				label: messages[Manager.for(tab).label],
				page: <MarketplaceList kind={tab} />,
			})),
		[],
	);

	const state = Discord.useSegmentedControlState({
		items,
		pageWidth: Dimensions.get('window').width,
		defaultIndex: kind ? ADDON_KINDS.indexOf(kind) : 0,
		onPageChange: setTab,
	});

	// A link opened while the page is mounted only changes its params.
	useEffect(() => {
		if (!id) return;

		setSearch(id);

		if (kind) {
			state.setActiveIndex(ADDON_KINDS.indexOf(kind));
		}
	}, [id, kind, request]);

	useEffect(() => {
		const key = `${id}:${request}`;

		if (!id || lastOfferedOpen.current === key || catalog?.status !== 'ready') return;

		const addon = catalog.catalog.addons.find((listed) => listed.id === id);

		if (!addon) return;

		lastOfferedOpen.current = key;
		void offerListedInstall(addon.type, addon);
	}, [id, request, catalog]);

	return (
		<View style={styles.fill}>
			<View style={styles.header}>
				<Discord.Stack direction='horizontal' spacing={8} align='center'>
					<View style={styles.search}>
						<Discord.SearchBar
							size='md'
							value={search}
							onChange={setSearch}
							placeholder={format('UNBOUND_SEARCH', {
								type: messages.UNBOUND_MARKETPLACE,
							})}
						/>
					</View>
					<FilterButton kind={active} filters={filters} onChange={setFilters} />
				</Discord.Stack>
				<Discord.SegmentedControl state={state} />
				<FilterChips kind={active} filters={filters} onChange={setFilters} />
			</View>
			<BrowseContext.Provider value={browse}>
				<View style={styles.fill}>
					<Discord.SegmentedControlPages state={state} />
				</View>
			</BrowseContext.Provider>
		</View>
	);
}

export default MarketplacePage;

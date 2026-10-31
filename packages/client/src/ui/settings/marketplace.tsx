import { useEffect, useMemo, useRef, useState } from 'react';
import type { AddonKind } from '@unbound-app/types/addons';
import { ADDON_KINDS } from '@unbound-app/types/addons';
import { Dimensions, View } from 'react-native';

import { offerListedInstall } from '~/ui/marketplace/offer-listed-install';
import MarketplaceList from '~/ui/marketplace/marketplace-list';
import SearchContext from '~/ui/marketplace/search-context';
import { Discord, SafeArea } from '~/metro/components';
import MarketplaceStore from '~/marketplace/state';
import { messages, format } from '~/i18n/api';
import { Manager } from '~/addons/manager';

type MarketplaceParams = {
	/** Opens on the tab of this manager, e.g. the page the install menu was opened from. */
	kind?: AddonKind;
	/** Narrows the search to this addon and offers to install it, e.g. from an `astral://` link. */
	id?: string;
	/** Tells one open of `id` from the next, so opening the same link again asks again. */
	request?: number;
};

type MarketplacePageProps = {
	route: { params?: MarketplaceParams };
};

/**
 * @description The addon marketplace: a search field over one swipeable tab per addon type, listing
 * the catalog stored on device. Opening the page refreshes the catalog in the background.
 */
function MarketplacePage({ route }: MarketplacePageProps) {
	const { kind, id, request } = route.params ?? {};
	const [search, setSearch] = useState(id ?? '');
	const catalog = MarketplaceStore((store) => store.state);
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

		if (!id || lastOfferedOpen.current === key || catalog.status !== 'ready') return;

		const addon = catalog.catalog.addons.find((listed) => listed.id === id);

		if (!addon) return;

		lastOfferedOpen.current = key;
		void offerListedInstall(addon.type, addon);
	}, [id, request, catalog]);

	return (
		<SafeArea.SafeAreaPaddingView bottom style={{ flex: 1 }}>
			<View
				style={{
					flexGrow: 0,
					flexShrink: 0,
					gap: 12,
					paddingHorizontal: 16,
					paddingTop: 16,
				}}
			>
				<Discord.SearchField
					size='md'
					value={search}
					onChange={setSearch}
					isClearable
					placeholder={format('UNBOUND_SEARCH', { type: messages.UNBOUND_MARKETPLACE })}
				/>
				<Discord.SegmentedControl state={state} />
			</View>
			<SearchContext.Provider value={search}>
				<View style={{ flex: 1 }}>
					<Discord.SegmentedControlPages state={state} />
				</View>
			</SearchContext.Provider>
		</SafeArea.SafeAreaPaddingView>
	);
}

export default MarketplacePage;

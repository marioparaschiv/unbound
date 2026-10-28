import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, View } from 'react-native';

import {
	MARKETPLACE_TABS,
	MarketplaceList,
	SearchContext,
	offerListedInstall,
} from '~/ui/marketplace';
import { Discord, SafeArea } from '~/api/metro/components';
import MarketplaceStore from '~/stores/marketplace';
import type { ManagerKind } from '~/lib/constants';
import { Messages, format } from '~/api/i18n';

type MarketplaceParams = {
	/** Opens on the tab of this manager, e.g. the page the install menu was opened from. */
	kind?: ManagerKind;
	/** Narrows the search to this addon and offers to install it, e.g. from an `unbound://` link. */
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
			MARKETPLACE_TABS.map((tab) => ({
				id: tab.type,
				label: tab.label(),
				page: <MarketplaceList tab={tab} />,
			})),
		[],
	);

	const state = Discord.useSegmentedControlState({
		items,
		pageWidth: Dimensions.get('window').width,
		defaultIndex: Math.max(
			0,
			MARKETPLACE_TABS.findIndex((tab) => tab.kind === kind),
		),
	});

	// A link opened while the page is mounted only changes its params.
	useEffect(() => {
		if (!id) return;

		setSearch(id);

		const index = MARKETPLACE_TABS.findIndex((tab) => tab.kind === kind);

		if (~index) {
			state.setActiveIndex(index);
		}
	}, [id, kind, request]);

	useEffect(() => {
		const key = `${id}:${request}`;

		if (!id || lastOfferedOpen.current === key || catalog.status !== 'ready') return;

		const addon = catalog.catalog.addons.find((listed) => listed.id === id);
		const tab = MARKETPLACE_TABS.find((candidate) => candidate.type === addon?.type);

		if (!addon || !tab) return;

		lastOfferedOpen.current = key;
		void offerListedInstall(tab.kind, addon);
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
					placeholder={format('UNBOUND_SEARCH', { type: Messages.UNBOUND_MARKETPLACE })}
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

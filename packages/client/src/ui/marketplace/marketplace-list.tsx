import { memo, useContext, useMemo, useState } from 'react';
import type { AddonKind } from '@unbound-app/types/addons';
import { RefreshControl, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';

import MarketplaceStore from '~/stores/marketplace';
import { Messages, format } from '~/api/i18n';
import { queryCatalog } from '~/lib/catalog';
import { Theme } from '~/api/metro/common';
import { Manager } from '~/managers/base';
import { showToast } from '~/api/toasts';
import { Empty } from '~/ui/components';

import MarketplaceSkeleton from './marketplace-skeleton';
import MarketplaceCard from './marketplace-card';
import useCardMotion from './use-card-motion';
import SearchContext from './search-context';

type MarketplaceListProps = {
	kind: AddonKind;
};

/**
 * @description One marketplace tab: the stored catalog narrowed to the tab's kind and the search, as
 * cards. Pulling down refreshes the catalog; a failed refresh keeps the stored copy and says so.
 */
function MarketplaceList({ kind }: MarketplaceListProps) {
	const state = MarketplaceStore((store) => store.state);
	const search = useContext(SearchContext);
	const motion = useCardMotion();
	// Only a pull shows the spinner, so the background refresh on open doesn't shift the list.
	const [pulling, setPulling] = useState(false);

	const addons = useMemo(
		() =>
			state.status === 'ready'
				? queryCatalog(state.catalog.addons, { type: kind, search })
				: [],
		[state, kind, search],
	);

	async function pull() {
		setPulling(true);

		const ok = await MarketplaceStore.getState().refresh();

		setPulling(false);

		if (!ok && MarketplaceStore.getState().state.status === 'ready') {
			showToast({
				title: Messages.UNBOUND_MARKETPLACE,
				content: Messages.UNBOUND_MARKETPLACE_REFRESH_FAILED,
				icon: 'CircleXIcon',
			});
		}
	}

	const label = Messages[Manager.for(kind).label].toLowerCase();
	const empty =
		state.status === 'failed' ? (
			<Empty image='empty_permission'>{Messages.UNBOUND_MARKETPLACE_ERROR}</Empty>
		) : state.status === 'ready' ? (
			<Empty image={search ? 'sticker_search_empty' : 'empty_permission'}>
				{search
					? Messages.UNBOUND_EMPTY_RESULTS
					: format('UNBOUND_MARKETPLACE_EMPTY', { type: label })}
			</Empty>
		) : (
			<MarketplaceSkeleton />
		);

	return (
		<ScrollView
			contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 12 }}
			keyboardDismissMode='on-drag'
			refreshControl={
				<RefreshControl
					refreshing={pulling}
					onRefresh={pull}
					tintColor={Theme.colors.INTERACTIVE_ICON_DEFAULT}
				/>
			}
		>
			{addons.length
				? addons.map((addon) => (
						<Animated.View key={addon.id} {...motion}>
							<MarketplaceCard addon={addon} kind={kind} />
						</Animated.View>
					))
				: empty}
		</ScrollView>
	);
}

export default memo(MarketplaceList);

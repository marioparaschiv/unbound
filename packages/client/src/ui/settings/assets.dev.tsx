import { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, View } from 'react-native';

import { Discord, SafeArea } from '~/metro/components';
import { getAll, getIdByName } from '~/assets/api';
import FlashList from '~/ui/components/flash-list';
import Empty from '~/ui/components/empty-state';
import { messages, format } from '~/i18n/api';

import type { IndexedAsset, ToScreen } from './asset-row.dev';

import AssetRow from './asset-row.dev';
import useStyles from './assets.style';

type AssetRowInfo = { item: IndexedAsset; index: number };

const keyOf = (entry: IndexedAsset) => entry.asset.name;

/**
 * @description Searchable browser over registered PNG assets: a pinned search field over a virtualised list of
 * thumbnail rows that runs to the bottom edge.
 */
function AssetsPage() {
	const styles = useStyles();
	const [search, setSearch] = useState('');
	const page = useRef<View>(null);

	// Settings is a bottom-anchored sheet with its own root; the media viewer lays out from the screen's top.
	// The gap under the page's bottom edge is how far down the sheet sits.
	const toScreen = useCallback<ToScreen>((rect, done) => {
		page.current?.measureInWindow((_x, y, _width, height) =>
			done({ ...rect, y: rect.y + Dimensions.get('window').height - (y + height) }),
		);
	}, []);

	// Resolve ids and pre-lowercase names once, dropping assets that don't resolve, so neither the
	// per-row lookup nor the per-keystroke case-folding happens during render.
	const assets = useMemo(() => {
		const indexed: IndexedAsset[] = [];

		for (const asset of getAll()) {
			if (asset.type !== 'png') {
				continue;
			}

			const id = getIdByName(asset.name);

			if (!id) {
				continue;
			}

			indexed.push({ asset, id, query: asset.name.toLowerCase() });
		}

		return indexed;
	}, []);

	const filtered = useMemo(() => {
		if (!search) {
			return assets;
		}

		const query = search.toLowerCase();

		return assets.filter((entry) => entry.query.includes(query));
	}, [assets, search]);

	const total = filtered.length;

	function renderRow({ item, index }: AssetRowInfo) {
		return <AssetRow item={item} index={index} total={total} toScreen={toScreen} />;
	}

	return (
		<View ref={page} style={styles.page}>
			<View style={styles.controls}>
				<Discord.SearchBar
					size='md'
					value={search}
					onChange={setSearch}
					placeholder={format('UNBOUND_SEARCH', { type: messages.UNBOUND_ASSETS })}
				/>
			</View>
			<FlashList
				data={filtered}
				// The first and last rows round their corners, so a new count redraws them.
				extraData={String(total)}
				keyExtractor={keyOf}
				renderItem={renderRow}
				estimatedItemSize={48}
				ListEmptyComponent={
					<Empty image={search ? 'sticker_search_empty' : 'empty_permission'}>
						{search ? messages.UNBOUND_EMPTY_RESULTS : messages.UNBOUND_NO_ASSETS}
					</Empty>
				}
				// The bottom inset pads the end of the list, so the rows scroll under the home indicator.
				ListFooterComponent={<SafeArea.SafeAreaPaddingView bottom />}
				keyboardDismissMode='on-drag'
				contentContainerStyle={styles.content}
			/>
		</View>
	);
}

export default AssetsPage;

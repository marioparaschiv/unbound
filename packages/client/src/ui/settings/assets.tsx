import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Discord, FlashList } from '~/metro/components';
import SearchIcon from '~/ui/components/search-icon';
import { getAll, getIdByName } from '~/assets/api';
import Empty from '~/ui/components/empty-state';
import { messages, format } from '~/i18n/api';

import type { IndexedAsset } from './asset-row';

import useStyles from './assets.style';
import AssetRow from './asset-row';

type AssetRowInfo = { item: IndexedAsset; index: number };

/**
 * @description Searchable browser over registered PNG assets, previewing each as a thumbnail.
 */
function AssetsPage() {
	const styles = useStyles();
	const [search, setSearch] = useState('');

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

	return (
		<View style={styles.container}>
			<View style={styles.search}>
				<Discord.TextField
					size='md'
					value={search}
					onChange={setSearch}
					isClearable
					isRound
					placeholder={format('UNBOUND_SEARCH', { type: messages.UNBOUND_ASSETS })}
					leadingIcon={SearchIcon}
				/>
			</View>
			{total ? (
				<FlashList.FlashList
					data={filtered}
					keyExtractor={(entry: IndexedAsset) => entry.asset.name}
					estimatedItemSize={48}
					renderItem={({ item, index }: AssetRowInfo) => (
						<AssetRow item={item} index={index} total={total} />
					)}
				/>
			) : (
				<Empty image={search ? 'sticker_search_empty' : 'empty_permission'}>
					{search ? messages.UNBOUND_EMPTY_RESULTS : messages.UNBOUND_NO_ASSETS}
				</Empty>
			)}
		</View>
	);
}

export default AssetsPage;

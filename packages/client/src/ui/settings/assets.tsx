import type { UnboundAsset } from '@unbound-app/types';
import { Image, View } from 'react-native';
import { useMemo, useState } from 'react';

import { Discord, FlashList } from '~/api/metro/components';
import { getAll, getIDByName } from '~/api/assets';

type AssetRow = { item: UnboundAsset };

/**
 * @description Searchable browser over registered PNG assets, previewing each as a thumbnail.
 */
function AssetsPage() {
	const [search, setSearch] = useState('');

	const assets = useMemo(() => getAll().filter((asset) => asset.type === 'png'), []);
	const filtered = useMemo(
		() => assets.filter((asset) => asset.name.toLowerCase().includes(search.toLowerCase())),
		[assets, search],
	);

	return (
		<View style={{ flex: 1, padding: 16, gap: 12 }}>
			<Discord.SearchField value={search} onChange={setSearch} />
			<FlashList.FlashList
				data={filtered}
				keyExtractor={(asset: UnboundAsset) => asset.name}
				estimatedItemSize={56}
				ItemSeparatorComponent={Discord.TableRowDivider}
				renderItem={({ item }: AssetRow) => {
					const id = getIDByName(item.name);
					return (
						<Discord.TableRow
							label={item.name}
							subLabel={`${item.width}×${item.height}`}
							icon={
								id ? <Image source={id} style={{ width: 24, height: 24 }} /> : null
							}
						/>
					);
				}}
			/>
		</View>
	);
}

export default AssetsPage;

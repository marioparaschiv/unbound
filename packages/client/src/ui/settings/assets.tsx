import type { UnboundAsset } from '@unbound-app/types';
import { Image, View } from 'react-native';
import { useMemo, useState } from 'react';

import { Discord, FlashList } from '~/api/metro/components';
import { getAll, getIDByName } from '~/api/assets';
import { Messages, format } from '~/api/i18n';
import { Radius } from '~/api/metro/common';
import { Empty } from '~/ui/components';

type AssetRowInfo = { item: UnboundAsset; index: number };

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
			<Discord.TextInput
				size='md'
				value={search}
				onChange={setSearch}
				isClearable
				borderRadius={Radius.Radius.lg}
				placeholder={format('UNBOUND_SEARCH', { type: Messages.UNBOUND_ASSETS })}
				leadingIcon={() => (
					<Discord.TableRowIcon source={getIDByName('MagnifyingGlassIcon')} />
				)}
			/>
			{filtered.length ? (
				<FlashList.FlashList
					data={filtered}
					keyExtractor={(asset: UnboundAsset) => asset.name}
					estimatedItemSize={48}
					renderItem={({ item, index }: AssetRowInfo) => {
						const id = getIDByName(item.name);
						return (
							<Discord.TableRow
								label={item.name}
								start={index === 0}
								end={index === filtered.length - 1}
								trailing={
									<Discord.TableRow.TrailingText
										text={`${item.width}×${item.height}`}
									/>
								}
								icon={
									id ? (
										<Image source={id} style={{ width: 24, height: 24 }} />
									) : null
								}
							/>
						);
					}}
				/>
			) : (
				<Empty>
					{search ? Messages.UNBOUND_EMPTY_RESULTS : Messages.UNBOUND_NO_ASSETS}
				</Empty>
			)}
		</View>
	);
}

export default AssetsPage;

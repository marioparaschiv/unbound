import type { GestureResponderEvent, NativeTouchEvent } from 'react-native';
import type { UnboundAsset } from '@unbound-app/types';
import { Image, View } from 'react-native';
import { useMemo, useState } from 'react';

import { Discord, FlashList, Media } from '~/api/metro/components';
import { getAll, getIDByName, Icons } from '~/api/assets';
import { Messages, format } from '~/api/i18n';
import { findByProps } from '~/api/metro';
import { Empty } from '~/ui/components';

type AssetRowInfo = { item: UnboundAsset; index: number };

const AssetHandler = findByProps('getAssetUriForEmbed', { lazy: true });

/**
 * @description Opens the tapped asset in Discord's fullscreen media viewer (pinch-to-zoom), animating
 * out from the tap position. Resolves the asset's embed URI, measures it, then presents the modal.
 */
function openAsset(id: number, event: NativeTouchEvent) {
	const uri = AssetHandler.getAssetUriForEmbed(id);

	Image.getSize(uri, (width, height) => {
		Media.openMediaModal({
			originLayout: {
				width: 0,
				height: 0,
				x: event.pageX,
				y: event.pageY,
				resizeMode: 'fill',
			},
			initialIndex: 0,
			initialSources: [{ uri, sourceURI: uri, width, height }],
		});
	});
}

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
			<View style={{ flexGrow: 0, flexShrink: 0 }}>
				<Discord.TextField
					size='md'
					value={search}
					onChange={setSearch}
					isClearable
					isRound
					placeholder={format('UNBOUND_SEARCH', { type: Messages.UNBOUND_ASSETS })}
					leadingIcon={() => <Discord.TableRowIcon source={Icons.MagnifyingGlassIcon} />}
				/>
			</View>
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
								onPress={({ nativeEvent }: GestureResponderEvent) =>
									id ? openAsset(id, nativeEvent) : undefined
								}
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

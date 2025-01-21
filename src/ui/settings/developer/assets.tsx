import { FlatList, ScrollView, View, Image } from 'react-native';
import { memo, PureComponent, useMemo, useState } from 'react';
import type { Asset as AssetType } from '@typings/api/assets';
import { GeneralSearch } from '@ui/misc/search';
import { Discord } from '@api/metro/components';
import { Media } from '@api/metro/components';
import { Section } from '@ui/misc/forms';
import { findByProps } from '@api/metro';
import { assets } from '@api/assets';


const AssetHandler = findByProps('getAssetUriForEmbed', { lazy: true });

class Asset extends PureComponent<{ item: AssetType; id: number; index: number; total: number; }> {
	render() {
		const { item, index, total, id } = this.props;

		return <Discord.TableRow
			label={item.name}
			subLabel={`${item.type.toUpperCase()} - ${item.width}x${item.height} - ${id}`}
			trailing={<Image
				source={id}
				style={{
					width: 24,
					height: 24
				}}
			/>}
			onPress={({ nativeEvent }) => this.open(AssetHandler.getAssetUriForEmbed(id), nativeEvent)}
			start={index === 0}
			end={index === total - 1}
		/>;
	}

	open(uri: string, event) {
		Image.getSize(uri, (width, height) => {
			Media.openMediaModal({
				originLayout: {
					width: 0,
					height: 0,
					x: event.pageX,
					y: event.pageY,
					resizeMode: 'fill'
				},
				initialIndex: 0,
				initialSources: [
					{
						uri,
						sourceURI: uri,
						width,
						height
					}
				]
			});
		});
	}
}

const Assets = memo(() => {
	const [search, setSearch] = useState('');

	const payload = useMemo(() => [...assets.entries()].filter(([, a]) => a.type === 'png'), [assets.size]);

	const data = useMemo(() => {
		if (!search) return payload;

		return payload.filter((([, asset]) => asset.name.toLowerCase().includes(search.toLowerCase())));
	}, [search]);

	return <ScrollView key='unbound-assets'>
		<View style={{ marginHorizontal: 16, marginVertical: 12 }}>
			<GeneralSearch
				type='assets'
				search={search}
				setSearch={setSearch}
			/>
		</View>
		<Section style={{ flex: 1, marginBottom: 108 }} margin={false}>
			<FlatList
				keyExtractor={(_, idx) => idx.toString()}
				data={data}
				scrollEnabled={false}
				initialNumToRender={15}
				ItemSeparatorComponent={Discord.TableRowDivider}
				removeClippedSubviews
				renderItem={({ item: [id, asset], index }) => <Asset
					id={id}
					item={asset}
					index={index}
					total={data.length}
				/>}
			/>
		</Section>
	</ScrollView>;
});

export default Assets;
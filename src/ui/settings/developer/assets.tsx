import { FlatList, ScrollView, View, Image } from 'react-native';
import { memo, PureComponent, useMemo, useState } from 'react';
import type { Asset as AssetType } from '@typings/api/assets';
import { GeneralSearch } from '@ui/misc/search';
import { Design } from '@api/metro/components';
import { Media } from '@api/metro/components';
import { Section } from '@ui/misc/forms';
import { findByProps } from '@api/metro';
import { assets } from '@api/assets';

const AssetHandler = findByProps('getAssetUriForEmbed', { lazy: true });

const payload = [...assets.values()].filter(a => a.type === 'png');

class Asset extends PureComponent<{ item: AssetType; index: number; total: number; }> {
	render() {
		const { item, index, total } = this.props;

		return <Design.TableRow
			label={item.name}
			subLabel={`${item.type.toUpperCase()} - ${item.width}x${item.height} - ${item.id}`}
			trailing={<Image
				source={item.id}
				style={{
					width: 24,
					height: 24
				}}
			/>}
			onPress={({ nativeEvent }) => this.open(AssetHandler.getAssetUriForEmbed(item.id), nativeEvent)}
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

	const data = useMemo(() => {
		if (!search) return payload;

		return payload.filter((asset) => {
			return asset.name.toLowerCase().includes(search.toLowerCase());
		});
	}, [search]);

	return <ScrollView key='unbound-assets'>
		<View style={{ marginHorizontal: 16, marginVertical: 12 }}>
			<GeneralSearch
				type={'assets'}
				search={search}
				setSearch={setSearch}
			/>
		</View>
		<Section style={{ flex: 1, marginBottom: 108 }} margin={false}>
			<FlatList
				keyExtractor={(asset) => asset.id.toString()}
				data={data}
				scrollEnabled={false}
				initialNumToRender={15}
				ItemSeparatorComponent={Design.TableRowDivider}
				removeClippedSubviews
				renderItem={({ item, index }) => (
					<Asset
						item={item}
						index={index}
						total={data.length}
					/>
				)}
			/>
		</Section>
	</ScrollView>;
});

export default Assets;
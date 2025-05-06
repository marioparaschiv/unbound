import { Image, ScrollView, View, type GestureResponderEvent, type NativeTouchEvent } from 'react-native';
import { memo, PureComponent, useMemo, useState } from 'react';
import type { AssetProps } from '@typings/ui/settings/assets';
import { Discord, FlashList } from '@api/metro/components';
import { GeneralSearch } from '@ui/misc/search';
import { Media } from '@api/metro/components';
import { findByProps } from '@api/metro';
import { assets } from '@api/assets';

import useStyles from './assets.style';


const AssetHandler = findByProps('getAssetUriForEmbed', { lazy: true });

class Asset extends PureComponent<AssetProps> {
	render() {
		const { item, index, total, id } = this.props;

		return <Discord.TableRow
			label={item.name}
			subLabel={`${item.type.toUpperCase()} · ${item.width}x${item.height} · ${id}`}
			trailing={<Image
				source={id}
				style={{
					width: 24,
					height: 24
				}}
			/>}
			onPress={({ nativeEvent }: GestureResponderEvent) => this.open(AssetHandler.getAssetUriForEmbed(id), nativeEvent)}
			start={index === 0}
			end={index === total - 1}
		/>;
	}

	open(uri: string, event: NativeTouchEvent) {
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
	const styles = useStyles();

	const payload = useMemo(() => [...assets.entries()].filter(([, a]) => a.type === 'png'), [assets.size]);

	const data = useMemo(() => {
		if (!search) return payload;

		return payload.filter((([, asset]) => asset.name.toLowerCase().includes(search.toLowerCase())));
	}, [search]);

	return <View style={styles.container}>
		<GeneralSearch
			type='assets'
			search={search}
			setSearch={setSearch}
		/>

		<FlashList.FlashList
			data={data}
			keyExtractor={(_, idx) => idx.toString()}
			ItemSeparatorComponent={Discord.TableRowDivider}
			estimatedItemSize={60}
			removeClippedSubviews
			renderScrollComponent={({ children, ...props }) => <ScrollView {...props}>
				{children}
				<View style={styles.listEnd} />
			</ScrollView>}
			renderItem={({ item: [id, asset], index }) => <Asset
				id={id}
				item={asset}
				index={index}
				total={data.length}
			/>}
		/>
	</View>;
});

export default Assets;
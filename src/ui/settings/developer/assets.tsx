import { React, ReactNative as RN } from '@metro/common';
import { GeneralSearch } from '@ui/components/search';
import Asset from '@ui/components/internal/asset';
import { Section } from '@ui/components/misc';
import { Redesign } from '@metro/components';
import { assets } from '@api/assets';

const payload = [...assets.values()].filter(a => a.type === 'png');

const Assets = React.memo(() => {
	const [search, setSearch] = React.useState('');

	const data = React.useMemo(() => {
		if (!search) return payload;

		return payload.filter((asset) => {
			return asset.name.toLowerCase().includes(search.toLowerCase());
		});
	}, [search]);

	return <RN.ScrollView key='unbound-assets'>
		<RN.View style={{ marginHorizontal: 16, marginVertical: 12 }}>
			<GeneralSearch
				type={'assets'}
				search={search}
				setSearch={setSearch}
			/>
		</RN.View>
		<Section style={{ flex: 1, marginBottom: 108 }} margin={false}>
			<RN.FlatList
				keyExtractor={(asset) => asset.id.toString()}
				data={data}
				scrollEnabled={false}
				initialNumToRender={15}
				ItemSeparatorComponent={Redesign.TableRowDivider}
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
	</RN.ScrollView>;
});

export default Assets;
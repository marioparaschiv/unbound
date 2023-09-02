import { React, ReactNative as RN } from '@metro/common';
import { assets } from '@api/assets';

import Asset from '@ui/settings/components/Asset';
import AdvancedSearch, { useAdvancedSearch } from '@ui/components/AdvancedSearch';
import { findByProps } from '@metro';
import { Section } from '@ui/components/FormHandler';

const DividerModule = findByProps('TableRowDivider', { lazy: true });

const payload = [...assets.values()].filter(a => a.type === 'png');
const searchContext = { type: 'ASSETS' };

export default function () {
	const [query, controls] = useAdvancedSearch(searchContext);

	const data = React.useMemo(() => {
		if (!query) return payload;

		return payload.filter((asset) => {
			return asset.name.toLowerCase().includes(query.toLowerCase());
		});
	}, [query]);

	return <RN.View>
		<RN.View style={{ marginHorizontal: 16, marginBottom: 12 }}>
			<AdvancedSearch
				searchContext={searchContext}
				controls={controls}
			/>
		</RN.View>
		<Section style={{ flex: 1, marginBottom: 108 }} margin={false}>
			<RN.FlatList
				keyExtractor={(asset) => asset.id.toString()}
				data={data}
				scrollEnabled={false}
				ItemSeparatorComponent={DividerModule.TableRowDivider}
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
	</RN.View>;
}
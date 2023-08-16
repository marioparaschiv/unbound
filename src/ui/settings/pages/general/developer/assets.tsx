import { React, ReactNative as RN } from '@metro/common';
import { assets } from '@api/assets';

import Asset from '@ui/settings/components/asset';
import { TableRowGroupWrapper } from '@ui/components';
import AdvancedSearch, { useAdvancedSearch } from '@ui/components/AdvancedSearch';
import { findByProps } from '@metro';

const DividerModule = findByProps('TableRowDivider', { lazy: true });

const payload = [...assets.values()].filter(a => a.type === 'png');
const searchContext = { type: 'ASSETS' }

export default function () {
    const [query, controls] = useAdvancedSearch(searchContext);

    const data = React.useMemo(() => {
        return payload.filter((asset) => {
            if (!query) return true;
            return asset.name.toLowerCase().includes(query.toLowerCase());
        })
    }, [query])

	return <RN.View>
        <RN.View style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <AdvancedSearch 
                searchContext={searchContext}
                controls={controls}
            />
        </RN.View>
        <TableRowGroupWrapper style={{ flex: 1, marginBottom: 160 }} margin={false}>
            <RN.FlatList
                keyExtractor={(asset) => asset.id.toString()}
                data={data}
                scrollEnabled={false}
                ItemSeparatorComponent={DividerModule.TableRowDivider}
                renderItem={({ item, index }) => (
                    <Asset 
                        item={item} 
                        index={index} 
                        total={data.length} 
                    />
                )}
            />
        </TableRowGroupWrapper>
	</RN.View>;
}
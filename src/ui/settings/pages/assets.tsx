import { React, ReactNative as RN, i18n } from '@metro/common';
import { assets } from '@api/assets';

import { Forms, Search } from '@metro/components';
import Asset from '@ui/settings/components/asset';

export default function () {
  const [search, setSearch] = React.useState<string>();

  const payload = [...assets.values()].filter(a => a.type === 'png');
  const data = search ? [] : payload;

  if (search) {
    for (const asset of payload) {
      if (
        asset.name.toLowerCase().includes(search) ||
        asset.httpServerLocation.toLowerCase().includes(search)
      ) {
        data.push(asset);
      }
    }
  }

  return <RN.View>
    <Search
      placeholder={i18n.Messages['ENMITY_SEARCH_ASSETS']}
      onChangeText={search => setSearch(search)}
      onClear={() => setSearch('')}
      value={search}
    />
    <Forms.FormSection style={{ flex: 1 }}>
      <RN.FlatList
        keyExtractor={(_, idx) => String(idx)}
        data={data}
        ItemSeparatorComponent={Forms.FormDivider}
        renderItem={({ item }) => <Asset item={item} />}
      />
    </Forms.FormSection>
  </RN.View>;
}
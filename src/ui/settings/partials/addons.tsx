import { i18n, React, ReactNative as RN } from '@metro/common';
import { Search } from '@metro/components';
import { Addon } from '@typings/managers';
import AddonCard from './addoncard';

interface AddonListProps {
  addons: Addon[];
  type: 'themes' | 'plugins';
}


export default function ({ addons, type }: AddonListProps) {
  const [search, setSearch] = React.useState('');

  const data = search ? [] : addons;

  if (search) {
    for (const addon of addons) {
      if (
        addon.data.name.toLowerCase().includes(search) ||
        addon.data.description.toLowerCase().includes(search) ||
        addon.data.authors.some(a => typeof a === 'string' ? a.includes(search) : a.name.includes(search))
      ) {
        data.push(addon);
      }
    }
  }

  return <RN.SafeAreaView style={{ flex: 1 }}>
    <RN.View style={{ flex: 1 }}>
      <Search
        placeholder={i18n.Messages[`ENMITY_SEARCH_${type.toUpperCase()}`]}
        onChangeText={search => setSearch(search)}
        onClear={() => setSearch('')}
        value={search}
      />
      <RN.FlatList
        data={data}
        renderItem={(item) => <AddonCard addon={item.item} />}
        keyExtractor={(_, idx) => String(idx)}
      />
    </RN.View>
  </RN.SafeAreaView>;
}

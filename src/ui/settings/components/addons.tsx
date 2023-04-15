import type { Addon } from '@typings/managers';

import { i18n, React, ReactNative as RN, StyleSheet } from '@metro/common';
import { useSettingsStore } from '@api/storage';
import { managers } from '@api';

import { HelpMessage } from '@metro/components';
import { Search } from '@ui/components';
import AddonCard from './addoncard';

interface AddonListProps {
  type: 'themes' | 'plugins';
  shouldRestart?: boolean;
  addons: Addon[];
}

const styles = StyleSheet.createThemedStyleSheet({
  root: {
    flex: 1
  },
  recoveryContainer: {
    paddingHorizontal: 10,
    marginBottom: 10
  },
});

export default function ({ addons, type, shouldRestart }: AddonListProps) {
  const [search, setSearch] = React.useState('');
  const settings = useSettingsStore('enmity');

  const data = search ? [] : addons;
  const isRecovery = settings.get('recovery', false);

  if (search) {
    for (const addon of addons) {
      if (
        addon.data.name.toLowerCase().includes(search) ||
        addon.data.description.toLowerCase().includes(search) ||
        addon.data.authors.some(a => a.name.includes(search))
      ) {
        data.push(addon);
      }
    }
  }

  return <RN.SafeAreaView style={styles.root}>
    <RN.View style={styles.root}>
      <Search
        placeholder={i18n.Messages[`ENMITY_SEARCH_${type.toUpperCase()}`]}
        onChangeText={search => setSearch(search)}
        onClear={() => setSearch('')}
        value={search}
      />
      {isRecovery && <RN.View style={styles.recoveryContainer}>
        <HelpMessage messageType={0}>
          {i18n.Messages.ENMITY_RECOVERY_MODE_ENABLED}
        </HelpMessage>
      </RN.View>}
      <RN.FlatList
        data={data}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={(item) => <AddonCard
          recovery={isRecovery}
          shouldRestart={shouldRestart}
          manager={managers[type]}
          addon={item.item}
        />}
      />
    </RN.View>
  </RN.SafeAreaView >;
}

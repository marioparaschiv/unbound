import type { Addon } from '@typings/managers';

import { Constants, i18n, React, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { useSettingsStore } from '@api/storage';
import { managers } from '@api';

import { HelpMessage, Navigation } from '@metro/components';
import { Search } from '@ui/components';
import AddonCard from './addoncard';
import { Icons } from '@api/assets';

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
	empty: {
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: '50%'
	},
	emptyImage: {
		marginBottom: 10
	},
	emptyMessage: {
		color: Theme.colors.TEXT_MUTED,
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		textAlign: 'center',
		paddingHorizontal: 25
	}
});

export default function ({ addons, type, shouldRestart }: AddonListProps) {
	const [search, setSearch] = React.useState('');
	const settings = useSettingsStore('unbound');
    const navigation = Navigation.useNavigation();

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
				placeholder={i18n.Messages[`UNBOUND_SEARCH_${type.toUpperCase()}`]}
				onChangeText={search => setSearch(search)}
				onClear={() => setSearch('')}
				value={search}
			/>
			{isRecovery && <RN.View style={styles.recoveryContainer}>
				<HelpMessage messageType={0}>
					{i18n.Messages.UNBOUND_RECOVERY_MODE_ENABLED}
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
                    navigation={navigation}
				/>}
				ListEmptyComponent={<RN.View style={styles.empty}>
					<RN.Image
						style={styles.emptyImage}
						source={Icons['img_connection_empty_dark']}
					/>
					<RN.Text style={styles.emptyMessage}>
						{i18n.Messages.UNBOUND_ADDONS_EMPTY.format({ type: managers[type].name.toLowerCase() })}
					</RN.Text>
				</RN.View>}
			/>
		</RN.View>
	</RN.SafeAreaView >;
}

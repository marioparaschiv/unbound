import type { Addon } from '@typings/managers';

import { Constants, i18n, React, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { useSettingsStore } from '@api/storage';
import { managers } from '@api';

import { HelpMessage, Navigation } from '@metro/components';
import AddonCard from './addoncard';
import { Icons } from '@api/assets';
import AdvancedSearch, { useAdvancedSearch } from '@ui/components/AdvancedSearch';

interface AddonListProps {
	type: 'themes' | 'plugins';
	shouldRestart?: boolean;
	addons: Addon[];
}

const searchContext = { type: 'ADDONS' };
const styles = StyleSheet.createThemedStyleSheet({
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
	const [search, controls] = useAdvancedSearch(searchContext);
	const settings = useSettingsStore('unbound');
	const navigation = Navigation.useNavigation();

	const data = React.useMemo(() => {
		if (!search) return addons;

		return addons.filter((addon) => {
			return [addon.data.name, addon.data.description]
				.some(x => x.toLowerCase().includes(search.toLowerCase()))
				|| addon.data.authors
					.some(a => a.name.toLowerCase().includes(search.toLowerCase()));
		});
	}, [search, addons]);
	const isRecovery = settings.get('recovery', false);

	return <RN.View>
		<RN.View style={{ marginHorizontal: 10 }}>
			<AdvancedSearch
				searchContext={searchContext}
				controls={controls}
			/>
		</RN.View>
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
	</RN.View >;
}

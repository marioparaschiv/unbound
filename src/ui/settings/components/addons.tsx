import { Constants, i18n, React, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { useSettingsStore } from '@api/storage';
import { managers } from '@api';
import { Icons } from '@api/assets';
import { showInstallAlert } from '@ui/settings/components/install-modal';

import { HelpMessage, Navigation } from '@metro/components';
import AdvancedSearch, { useAdvancedSearch } from '@ui/components/advanced-search';
import AddonCard from './addon-card';
import InstallModal from './install-modal';

import type { Addon, Manager } from '@typings/managers';

interface AddonListProps {
	type: Manager;
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
	const ref = React.useRef<InstanceType<typeof InstallModal.InstallInput>>();
	const navigation = Navigation.useNavigation();
	const settings = useSettingsStore('unbound');

	const isRecovery = settings.get('recovery', false);
	const data = React.useMemo(() => {
		if (!search) return addons;

		return addons.filter((addon) => {
			const fields = [addon.data.name, addon.data.description];

			const info = fields.some(x => x.toLowerCase().includes(search.toLowerCase()));
			if (info) return true;

			const authors = addon.data.authors.some(a => a.name.toLowerCase().includes(search.toLowerCase()));
			if (authors) return true;

			return false;
		});
	}, [search, addons]);

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
		<RN.ScrollView
			style={{ height: '100%' }}
			refreshControl={<RN.RefreshControl
				// Passing false here is fine because we don't actually need to handle refreshing
				// We just need access to the onRefresh method to open the install modal
				refreshing={false}
				onRefresh={() => showInstallAlert({ type, ref })}
				title={i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: managers[type].type })}
			/>}
		>
			<RN.FlatList
				data={data}
				keyExtractor={(_, idx) => String(idx)}
				scrollEnabled={false}
				renderItem={({ item }) => <AddonCard
					recovery={isRecovery}
					shouldRestart={shouldRestart}
					type={type}
					addon={item}
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
		</RN.ScrollView>
	</RN.View>;
};

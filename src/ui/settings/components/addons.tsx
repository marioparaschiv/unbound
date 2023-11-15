import { Constants, i18n, React, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { useSettingsStore } from '@api/storage';
import { managers } from '@api';
import { Icons } from '@api/assets';
import { showInstallAlert } from '@ui/settings/components/install-modal';

import { HelpMessage, Navigation } from '@metro/components';
import getItems, { resolveType } from '@ui/settings/models/ordering';
import AdvancedSearch, { useAdvancedSearch } from '@ui/components/advanced-search';
import AddonCard from './addon-card';
import InstallModal from './install-modal';
import HeaderRight from '@ui/settings/components/addon-header';

import type { Addon, Manager } from '@typings/managers';

interface AddonListProps {
	type: Manager;
	shouldRestart?: boolean;
	addons: Addon[];
	showHeaderRight?: boolean
	onPressInstall?: ({ ref, settings, type }) => any
}

const searchContext = { type: 'ADDONS' };
const useStyles = StyleSheet.createStyles({
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

export default function ({ addons, type, shouldRestart, showHeaderRight = true, onPressInstall }: AddonListProps) {
	const [search, controls] = useAdvancedSearch(searchContext);
	const ref = React.useRef<InstanceType<typeof InstallModal.InternalInstallInput>>();
	const navigation = Navigation.useNavigation();
	const settings = useSettingsStore('unbound');
	const styles = useStyles();

	React.useLayoutEffect(() => {
		if (showHeaderRight) {
			const unsubscribe = navigation.addListener('focus', () => {
				unsubscribe();

				navigation.setOptions({
					headerRight: () => <HeaderRight
						type={type}
						settings={settings}
						onPress={() => onPressInstall({ ref, settings, type })}
					/>
				});
			});
		}
	}, [])

	const isRecovery = settings.get('recovery', false);
	const order = settings.get(`${resolveType(type)}.order`, 'default');
	const reversed = settings.get(`${resolveType(type)}.reversed`, false);

	const data = React.useMemo(() => {
		const items = getItems(type, settings);
		const sorted = items.find(x => x.id === order).ordering(addons.slice());

		reversed && sorted.reverse();

		if (!search) return sorted;

		return sorted.filter((addon) => {
			const fields = [addon.data.name, addon.data.description];

			const info = fields.some(x => x.toLowerCase().includes(search.toLowerCase()));
			if (info) return true;

			const authors = addon.data.authors.some(a => a.name.toLowerCase().includes(search.toLowerCase()));
			if (authors) return true;

			return false;
		});
	}, [search, addons, order, reversed]);

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
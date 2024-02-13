import { Constants, React, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { showInstallAlert } from '@ui/components/internal/install-modal';
import HeaderRight from '@ui/components/internal/addon-header';
import { HelpMessage, Redesign } from '@metro/components';
import getItems, { resolveType } from '@ui/models/ordering';
import type { Addon, Manager } from '@typings/managers';
import { useSettingsStore } from '@api/storage';
import InstallModal from './install-modal';
import AddonCard from './addon-card';
import { Icons } from '@api/assets';
import * as managers from '@managers';
import { callbackWithAnimation, noop } from '@utilities';
import { Strings } from '@api/i18n';
import { GeneralSearch } from '@ui/components/search';

interface AddonListProps {
	type: Manager;
	shouldRestart?: boolean;
	addons: Addon[];
	showHeaderRight?: boolean;
	showToggles?: boolean;
	onPressInstall?: ({ ref, settings, type }) => any;
	headerRightMargin?: boolean;
}

const useStyles = StyleSheet.createStyles({
	recoveryContainer: {
		marginTop: 10
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

export default function Addons({ addons, type, shouldRestart, showHeaderRight = true, showToggles = true, onPressInstall, headerRightMargin }: AddonListProps) {
	const [search, setSearch] = React.useState('');
	const ref = React.useRef<InstanceType<typeof InstallModal.InternalInstallInput>>();
	const navigation = Redesign.useNavigation();
	const settings = useSettingsStore('unbound');
	const styles = useStyles();
	const manager = React.useMemo(() => managers[type], [type]);

	React.useLayoutEffect(() => {
		if (showHeaderRight) {
			const unsubscribe = navigation.addListener('focus', () => {
				unsubscribe();

				navigation.setOptions({
					headerRight: () => <HeaderRight
						type={type}
						settings={settings}
						onPress={() => onPressInstall({ ref, settings, type })}
						margin={headerRightMargin}
					/>
				});
			});
		}
	}, []);

	const isRecovery = settings.get('recovery', false);
	const order = settings.get(`${resolveType(type)}.order`, 'default');
	const reversed = settings.get(`${resolveType(type)}.reversed`, false);

	React.useLayoutEffect(() => {
		callbackWithAnimation(noop)();
	}, [settings.get('onboarding.install', false)]);

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

	return <RN.View style={{ marginHorizontal: 12, marginTop: 12 }}>
		<GeneralSearch
			type={manager.name}
			search={search}
			setSearch={setSearch}
		/>
		{settings.get('onboarding.install', false) && <RN.View style={styles.recoveryContainer}>
			<HelpMessage messageType={1}>
				{Strings.UNBOUND_ONBOARDING_ADDON_PAGE_INFO.format({ type: manager.type })}
			</HelpMessage>
		</RN.View>}
		{isRecovery && <RN.View style={styles.recoveryContainer}>
			<HelpMessage messageType={0}>
				{Strings.UNBOUND_RECOVERY_MODE_ENABLED}
			</HelpMessage>
		</RN.View>}
		<RN.ScrollView
			style={{ height: '100%' }}
			refreshControl={<RN.RefreshControl
				// Passing false here is fine because we don't actually need to handle refreshing
				// We just need access to the onRefresh method to open the install modal
				refreshing={false}
				onRefresh={() => showInstallAlert({ type, ref })}
				title={Strings.UNBOUND_INSTALL_TITLE.format({ type: manager.type })}
			/>}
		>
			<RN.FlatList
				data={data}
				keyExtractor={(_, idx) => String(idx)}
				scrollEnabled={false}
				renderItem={({ item }) => <AddonCard
					recovery={isRecovery}
					shouldRestart={shouldRestart}
					showToggles={showToggles}
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
						{Strings.UNBOUND_ADDONS_EMPTY.format({ type: manager.name.toLowerCase() })}
					</RN.Text>
				</RN.View>}
			/>
		</RN.ScrollView>
	</RN.View>;
};
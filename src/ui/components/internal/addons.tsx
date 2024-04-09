import { showInstallAlert } from '@ui/components/internal/install-modal';
import HeaderRight from '@ui/components/internal/addon-header';
import getItems, { resolveType } from '@ui/models/ordering';
import { HelpMessage, Redesign } from '@metro/components';
import { Authors } from '@ui/components/internal/authors';
import { callbackWithAnimation, noop } from '@utilities';
import { React, ReactNative as RN } from '@metro/common';
import type { Addon, Manager } from '@typings/managers';
import { GeneralSearch } from '@ui/components/search';
import Empty from '@ui/components/internal/empty';
import { useSettingsStore } from '@api/storage';
import { ManagerType } from '@managers/base';
import InstallModal from './install-modal';
import * as managers from '@managers';
import AddonCard from './addon-card';
import { Strings } from '@api/i18n';

interface AddonListProps {
	type: Manager;
	addons: Addon[];
	showHeaderRight?: boolean;
	showToggles?: boolean;
	onPressInstall?: ({ ref, settings, type }) => any;
	headerRightMargin?: boolean;
}

export default function Addons({ addons, type, showHeaderRight = true, showToggles = true, onPressInstall, headerRightMargin }: AddonListProps) {
	const [search, setSearch] = React.useState('');
	const ref = React.useRef<InstanceType<typeof InstallModal.InternalInstallInput>>();
	const navigation = Redesign.useNavigation();
	const settings = useSettingsStore('unbound');
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
	const isOnboarding = settings.get('onboarding.install', false);
	const order = settings.get(`${resolveType(type)}.order`, 'default');
	const reversed = settings.get(`${resolveType(type)}.reversed`, false);

	React.useLayoutEffect(() => {
		isOnboarding && callbackWithAnimation(noop)();
	}, [isOnboarding]);

	const data = React.useMemo(() => {
		const items = getItems(type, settings);
		const sorted = items[0].find(x => x.id === order).ordering(addons.slice());

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
		{isOnboarding && <RN.View style={{ marginTop: 10 }}>
			<HelpMessage messageType={1}>
				{Strings.UNBOUND_ONBOARDING_ADDON_PAGE_INFO.format({ type: manager.type })}
			</HelpMessage>
		</RN.View>}
		{isRecovery && <RN.View style={{ marginTop: 10 }}>
			<HelpMessage messageType={0}>
				{Strings.UNBOUND_RECOVERY_MODE_ENABLED}
			</HelpMessage>
		</RN.View>}
		<RN.ScrollView
			style={{ height: '100%' }}
			contentContainerStyle={{ paddingBottom: 80 }}
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
					showToggles={showToggles}
					type={type}
					addon={item}
					navigation={navigation}
					bottom={manager.type === ManagerType.Icons && item.data.id === 'default' ? null : <Authors addon={item} />}
				/>}
				ListEmptyComponent={<Empty>
					{Strings.UNBOUND_ADDONS_EMPTY.format({ type: manager.name.toLowerCase() })}
				</Empty>}
			/>
		</RN.ScrollView>
	</RN.View>;
};
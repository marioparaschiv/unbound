import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import getItems, { resolveType } from '@ui/addons/addon-ordering';
import { showInstallAlert } from '@ui/addons/install-modal';
import { callbackWithAnimation, noop } from '@utilities';
import type { Addon, Manager } from '@typings/managers';
import { HelpMessage, Design } from '@metro/components';
import { Authors } from '@ui/addons/addon-authors';
import HeaderRight from '@ui/addons/addon-header';
import { GeneralSearch } from '@ui/misc/search';
import { useSettingsStore } from '@api/storage';
import { ManagerType } from '@managers/base';
import Empty from '@ui/misc/empty-state';
import { React } from '@metro/common';
import * as managers from '@managers';
import { Strings } from '@api/i18n';

import InstallModal from './install-modal';
import AddonCard from './addon-card';

interface AddonListProps {
	type: Manager;
	addons: Addon[];
	showHeaderRight?: boolean;
	showToggles?: boolean;
	showManagerIcon?: ((addon: Addon) => boolean) | boolean;
	onPressInstall?: ({ ref, settings, type }) => any;
	headerRightMargin?: boolean;
}

export default function AddonList({ addons, type, showHeaderRight = true, showToggles = true, showManagerIcon = true, onPressInstall, headerRightMargin }: AddonListProps) {
	const [search, setSearch] = useState('');
	const ref = useRef<InstanceType<typeof InstallModal.InternalInstallInput>>();
	const navigation = Design.useNavigation();
	const settings = useSettingsStore('unbound');
	const manager = useMemo(() => managers[type], [type]);

	useLayoutEffect(() => {
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

	useLayoutEffect(() => {
		isOnboarding && callbackWithAnimation(noop)();
	}, [isOnboarding]);

	const data = useMemo(() => {
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

	return <View style={{ marginHorizontal: 12, marginTop: 12 }}>
		<GeneralSearch
			type={manager.name}
			search={search}
			setSearch={setSearch}
		/>
		{isOnboarding && <View style={{ marginTop: 10 }}>
			<HelpMessage messageType={1}>
				{Strings.UNBOUND_ONBOARDING_ADDON_PAGE_INFO.format({ type: manager.type })}
			</HelpMessage>
		</View>}
		{isRecovery && <View style={{ marginTop: 10 }}>
			<HelpMessage messageType={0}>
				{Strings.UNBOUND_RECOVERY_MODE_ENABLED}
			</HelpMessage>
		</View>}
		<ScrollView
			style={{ height: '100%' }}
			contentContainerStyle={{ paddingBottom: 80 }}
			refreshControl={<RefreshControl
				// Passing false here is fine because we don't actually need to handle refreshing
				// We just need access to the onRefresh method to open the install modal
				refreshing={false}
				onRefresh={() => showInstallAlert({ type, ref })}
				title={Strings.UNBOUND_INSTALL_TITLE.format({ type: manager.type })}
			/>}
		>
			<FlatList
				data={data}
				keyExtractor={(_, idx) => String(idx)}
				scrollEnabled={false}
				renderItem={({ item }) => <AddonCard
					recovery={isRecovery}
					showToggles={showToggles}
					showManagerIcon={showManagerIcon}
					type={type}
					addon={item}
					navigation={navigation}
					bottom={manager.type === ManagerType.Icons && item.data.id === 'default' ? null : <Authors addon={item} />}
				/>}
				ListEmptyComponent={<Empty>
					{Strings.UNBOUND_ADDONS_EMPTY.format({ type: manager.name.toLowerCase() })}
				</Empty>}
			/>
		</ScrollView>
	</View>;
};
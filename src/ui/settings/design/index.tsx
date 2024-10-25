import { Discord as DiscordDesign } from '@api/metro/components';
import { Dimensions, SafeAreaView, View } from 'react-native';
import InstallModal from '@ui/addons/install-modal';
import HeaderRight from '@ui/addons/addon-header';
import { useSettingsStore } from '@api/storage';
import { useLayoutEffect, useRef } from 'react';
import { Strings } from '@api/i18n';

// import Icons from './icons';
// import Fonts from './fonts';
import Themes from './themes';


const items = [
	{
		get label() {
			return Strings.UNBOUND_THEMES;
		},

		id: 'Themes',
		...Themes
	},
	{
		get label() {
			return Strings.UNBOUND_ICONS;
		},

		id: 'Icons',
		page: () => null
		// ...Icons
	},
	{
		get label() {
			return Strings.UNBOUND_FONTS;
		},

		id: 'Fonts',
		page: () => null
		// ...Fonts
	}
] as const;

export default function Design() {
	const ref = useRef<InstanceType<typeof InstallModal.InternalInstallInput>>();
	const navigation = DiscordDesign.useNavigation();
	const settings = useSettingsStore('unbound');
	const state = DiscordDesign.useSegmentedControlState({
		defaultIndex: settings.get('designPageIndex', 0),
		items,
		pageWidth: Dimensions.get('window').width,
		onPageChange(index: number) {
			settings.set('designPageIndex', index);
		}
	});

	useLayoutEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			unsubscribe();

			navigation.setOptions({
				headerRight: () => <HeaderRight
					type={() => items[settings.get('designPageIndex', 0)].id}
					settings={settings}
					onPress={() => {
						const index = settings.get('designPageIndex', 0);
						const item = items[index];

						item.callback({ ref, type: item.id });
					}}
				/>
			});
		});
	}, []);


	return <View
		style={{
			flex: 1,
			flexGrow: 1,
			justifyContent: 'space-between'
		}}
	>
		<DiscordDesign.SegmentedControlPages state={state} />
		<SafeAreaView
			style={{
				position: 'absolute',
				bottom: 0,
				height: 'auto',
				marginBottom: 36,
				marginHorizontal: 36
			}}
		>
			<DiscordDesign.SegmentedControl state={state} variant={'experimental_Large'} />
		</SafeAreaView>
	</View>;
};

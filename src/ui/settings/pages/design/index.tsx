import { Navigation, Redesign } from '@metro/components';
import { i18n } from '@metro/common';
import { InstallModal } from '@ui/settings/components';
import { useSettingsStore } from '@api/storage';

import Themes from './themes';
import Icons from './icons';
import Fonts from './fonts';
import HeaderRight from '@ui/settings/components/addon-header';

const items = [
	{
		get label() {
			return i18n.Messages.UNBOUND_THEMES;
		},

		id: 'themes',
		...Themes
	},
	{
		get label() {
			return i18n.Messages.UNBOUND_ICONS;
		},

		id: 'icons',
		...Icons
	},
	{
		get label() {
			return i18n.Messages.UNBOUND_FONTS;
		},

		id: 'fonts',
		...Fonts
	}
] as const;

export default () => {
	const ref = React.useRef<InstanceType<typeof InstallModal.InternalInstallInput>>();
	const navigation = Navigation.useNavigation();
	const settings = useSettingsStore('unbound');
	const state = Redesign.useSegmentedControlState({
		defaultIndex: settings.get('designPageIndex', 0),
		items,
		pageWidth: ReactNative.Dimensions.get('window').width,
		onPageChange(index: number) {
			settings.set('designPageIndex', index);
		}
	});

	React.useLayoutEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			unsubscribe();

			navigation.setOptions({
				headerRight: () => <HeaderRight
					type={() => items[settings.get('designPageIndex', 0)].id}
					settings={settings}
					onPress={() => {
						const index = settings.get('designPageIndex', 0);
						const item = items[index];

						item.callback({ ref, type: item.id })
					}}
				/>
			});
		});
	}, [])


	return <ReactNative.View
		style={{
			flex: 1,
			flexGrow: 1,
			justifyContent: 'space-between',
		}}
	>
		<Redesign.SegmentedControlPages state={state} />
		<ReactNative.View
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				bottom: 0,
				height: 50,
				marginBottom: 16,
				marginHorizontal: 16
			}}
		>
			<Redesign.SegmentedControl state={state} />
		</ReactNative.View>
	</ReactNative.View>;
};
